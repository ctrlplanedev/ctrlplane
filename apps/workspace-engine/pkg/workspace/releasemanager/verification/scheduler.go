package verification

import (
	"context"
	"fmt"
	"sync"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
)

// scheduler manages goroutines for running verification measurements.
// Each metric in each verification gets its own goroutine with a ticker.
// The scheduler delegates measurement execution to the executor and
// store updates to the recorder.
type scheduler struct {
	store    *store.Store
	executor *MeasurementExecutor
	recorder *MeasurementRecorder
	hooks    VerificationHooks

	mu                  sync.Mutex
	cancelFuncs         map[string][]context.CancelFunc // verification ID -> cancel functions (one per metric)
	completionHookFired map[string]bool                 // tracks if completion hook was already fired
}

// newScheduler creates a new verification scheduler
func newScheduler(store *store.Store, hooks VerificationHooks) *scheduler {
	return &scheduler{
		store:               store,
		executor:            NewMeasurementExecutor(store),
		recorder:            NewMeasurementRecorder(store),
		hooks:               hooks,
		cancelFuncs:         make(map[string][]context.CancelFunc),
		completionHookFired: make(map[string]bool),
	}
}

// StartVerification starts goroutines for all metrics in a verification.
// Each metric gets its own goroutine with a ticker at its interval.
func (s *scheduler) StartVerification(ctx context.Context, verificationID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already running
	if _, exists := s.cancelFuncs[verificationID]; exists {
		log.Debug("Verification already running", "verification_id", verificationID)
		return
	}

	// Check if verification exists and is not already completed
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		log.Error("Verification not found", "verification_id", verificationID)
		return
	}

	if s.isCompleted(verification) {
		log.Debug("Verification already completed, not starting goroutines",
			"verification_id", verificationID,
			"status", verification.Status())
		return
	}

	// Start a goroutine for each metric
	cancelFuncs := make([]context.CancelFunc, 0, len(verification.Metrics))
	for metricIndex := range verification.Metrics {
		metricCtx, cancel := context.WithCancel(ctx)
		cancelFuncs = append(cancelFuncs, cancel)
		go s.runMetricLoop(metricCtx, verificationID, metricIndex)
	}

	s.cancelFuncs[verificationID] = cancelFuncs

	log.Info("Started verification goroutines",
		"verification_id", verificationID,
		"metric_count", len(cancelFuncs))
}

// StopVerification stops all goroutines for a verification
func (s *scheduler) StopVerification(verificationID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if cancelFuncs, exists := s.cancelFuncs[verificationID]; exists {
		for _, cancel := range cancelFuncs {
			cancel()
		}
		delete(s.cancelFuncs, verificationID)
		delete(s.completionHookFired, verificationID)
		log.Info("Stopped verification goroutines",
			"verification_id", verificationID,
			"metric_count", len(cancelFuncs))
	}
}

// runMetricLoop runs measurements for a single metric on a ticker interval.
// All state is read from and written to the store - this goroutine is stateless.
func (s *scheduler) runMetricLoop(ctx context.Context, verificationID string, metricIndex int) {
	interval, err := s.getMetricInterval(verificationID, metricIndex)
	if err != nil {
		log.Error("Failed to get metric interval", "error", err)
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run first measurement immediately
	s.runMeasurementCycle(ctx, verificationID, metricIndex)

	for {
		select {
		case <-ctx.Done():
			log.Debug("Metric loop cancelled",
				"verification_id", verificationID,
				"metric_index", metricIndex)
			return

		case <-ticker.C:
			if s.shouldStopMetric(ctx, verificationID, metricIndex) {
				return
			}
			s.runMeasurementCycle(ctx, verificationID, metricIndex)
		}
	}
}

// runMeasurementCycle executes one measurement and handles all related side effects.
func (s *scheduler) runMeasurementCycle(ctx context.Context, verificationID string, metricIndex int) {
	// Fetch verification once to get metric and releaseID
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		log.Error("Verification not found", "verification_id", verificationID)
		return
	}

	if metricIndex >= len(verification.Metrics) {
		log.Error("Metric index out of range",
			"verification_id", verificationID,
			"metric_index", metricIndex)
		return
	}

	metric := &verification.Metrics[metricIndex]

	// Execute measurement with direct objects
	measurement, err := s.executor.Execute(ctx, metric, verification.ReleaseId)

	// Record result (measurement or error)
	if err != nil {
		verification, err = s.recorder.RecordError(ctx, verificationID, metricIndex, err)
		if err != nil {
			log.Error("Failed to record error", "error", err)
			return
		}
	} else {
		verification, err = s.recorder.RecordMeasurement(ctx, verificationID, metricIndex, measurement)
		if err != nil {
			log.Error("Failed to record measurement", "error", err)
			return
		}
	}

	// Fire hooks and update status
	s.handlePostMeasurement(ctx, verification, metricIndex)
}

// handlePostMeasurement fires hooks and updates verification status after a measurement.
func (s *scheduler) handlePostMeasurement(
	ctx context.Context,
	verification *oapi.ReleaseVerification,
	metricIndex int,
) {
	// Fire measurement taken hook
	lastIdx := len(verification.Metrics[metricIndex].Measurements) - 1
	if lastIdx >= 0 {
		lastMeasurement := &verification.Metrics[metricIndex].Measurements[lastIdx]
		if err := s.hooks.OnMeasurementTaken(ctx, verification, metricIndex, lastMeasurement); err != nil {
			log.Error("Measurement taken hook failed",
				"verification_id", verification.Id,
				"metric_index", metricIndex,
				"error", err)
		}
	}

	// Check if verification is complete and fire completion hook
	status := verification.Status()
	if status == oapi.ReleaseVerificationStatusRunning {
		return
	}

	s.mu.Lock()
	alreadyFired := s.completionHookFired[verification.Id]
	if !alreadyFired {
		s.completionHookFired[verification.Id] = true
	}
	s.mu.Unlock()

	if alreadyFired {
		return
	}

	// Update summary message
	message := s.buildSummaryMessage(verification, status)
	if err := s.recorder.UpdateMessage(ctx, verification.Id, message); err != nil {
		log.Error("Failed to update verification message", "error", err)
	}

	// Fire completion hook
	if err := s.hooks.OnVerificationComplete(ctx, verification); err != nil {
		log.Error("Verification complete hook failed",
			"verification_id", verification.Id,
			"error", err)
	}

	log.Info("Metric measurement completed",
		"verification_id", verification.Id,
		"metric_index", metricIndex,
		"metric_name", verification.Metrics[metricIndex].Name,
		"release_id", verification.ReleaseId,
		"verification_status", status,
		"metric_measurement_count", len(verification.Metrics[metricIndex].Measurements))
}

// shouldStopMetric checks if a metric loop should stop and fires the metric complete hook.
func (s *scheduler) shouldStopMetric(ctx context.Context, verificationID string, metricIndex int) bool {
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		log.Warn("Verification not found in store, stopping",
			"verification_id", verificationID)
		return true
	}

	if metricIndex >= len(verification.Metrics) {
		log.Warn("Metric index out of range, stopping",
			"verification_id", verificationID,
			"metric_index", metricIndex)
		return true
	}

	metric := &verification.Metrics[metricIndex]
	measurements := metrics.NewMeasurements(metric.Measurements)

	if measurements.ShouldContinue(metric) {
		return false
	}

	// Metric is complete - fire hook
	if err := s.hooks.OnMetricComplete(ctx, verification, metricIndex); err != nil {
		log.Error("Metric complete hook failed",
			"verification_id", verificationID,
			"metric_index", metricIndex,
			"error", err)
	}

	log.Info("Metric complete, stopping loop",
		"verification_id", verificationID,
		"metric_index", metricIndex,
		"metric_name", metric.Name)

	return true
}

// Helper methods

func (s *scheduler) isCompleted(v *oapi.ReleaseVerification) bool {
	status := v.Status()
	return status == oapi.ReleaseVerificationStatusPassed ||
		status == oapi.ReleaseVerificationStatusFailed
}

const defaultMetricInterval = 30 * time.Second

func (s *scheduler) getMetricInterval(verificationID string, metricIndex int) (time.Duration, error) {
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		return 0, fmt.Errorf("verification not found: %s", verificationID)
	}

	if metricIndex >= len(verification.Metrics) {
		return 0, fmt.Errorf("metric index out of range: %d", metricIndex)
	}

	interval := verification.Metrics[metricIndex].GetInterval()
	if interval <= 0 {
		return defaultMetricInterval, nil
	}

	return interval, nil
}

func (s *scheduler) buildSummaryMessage(v *oapi.ReleaseVerification, status oapi.ReleaseVerificationStatus) string {
	totalMeasurements := 0
	passedMeasurements := 0
	failedMeasurements := 0
	inconclusiveMeasurements := 0

	for _, m := range v.Metrics {
		for _, measurement := range m.Measurements {
			totalMeasurements++
			switch measurement.Status {
			case oapi.Passed:
				passedMeasurements++
			case oapi.Failed:
				failedMeasurements++
			case oapi.Inconclusive:
				inconclusiveMeasurements++
			}
		}
	}

	return fmt.Sprintf("Verification %s: %d passed, %d failed, %d inconclusive (%d total) across %d metrics",
		status, passedMeasurements, failedMeasurements, inconclusiveMeasurements, totalMeasurements, len(v.Metrics))
}
