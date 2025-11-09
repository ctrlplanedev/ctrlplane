package verification

import (
	"context"
	"fmt"
	"sync"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
)

// Scheduler manages goroutines for running verification measurements
// Each metric in each verification gets its own goroutine with a ticker
type Scheduler struct {
	store *store.Store

	mu          sync.Mutex
	cancelFuncs map[string][]context.CancelFunc // Map of verification ID to list of cancel functions (one per metric)
}

// NewScheduler creates a new verification scheduler
func NewScheduler(store *store.Store) *Scheduler {
	return &Scheduler{
		store:       store,
		cancelFuncs: make(map[string][]context.CancelFunc),
	}
}

// StartVerification starts goroutines for all metrics in a verification
// Each metric gets its own goroutine with a ticker at its interval
func (s *Scheduler) StartVerification(ctx context.Context, verificationID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already running
	if _, exists := s.cancelFuncs[verificationID]; exists {
		log.Debug("Verification already running", "verification_id", verificationID)
		return
	}

	// Check if verification is already in a completed state
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		log.Error("Verification not found", "verification_id", verificationID)
		return
	}

	status := verification.Status()
	if status == oapi.ReleaseVerificationStatusPassed ||
		status == oapi.ReleaseVerificationStatusFailed {
		log.Debug("Verification already completed, not starting goroutines",
			"verification_id", verificationID,
			"status", status)
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

	log.Info("Started verification goroutines", "verification_id", verificationID, "metric_count", len(cancelFuncs))
}

// StopVerification stops all goroutines for a verification
func (s *Scheduler) StopVerification(verificationID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if cancelFuncs, exists := s.cancelFuncs[verificationID]; exists {
		for _, cancel := range cancelFuncs {
			cancel()
		}
		delete(s.cancelFuncs, verificationID)
		log.Info("Stopped verification goroutines", "verification_id", verificationID, "metric_count", len(cancelFuncs))
	}
}

// runMetricLoop runs measurements for a single metric on a ticker interval
// All state is read from and written to the store - this goroutine is stateless
func (s *Scheduler) runMetricLoop(ctx context.Context, verificationID string, metricIndex int) {
	// Read the verification to get the metric
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		log.Error("Verification not found", "verification_id", verificationID)
		return
	}

	if metricIndex >= len(verification.Metrics) {
		log.Error("Metric index out of range", "verification_id", verificationID, "metric_index", metricIndex)
		return
	}

	metric := &verification.Metrics[metricIndex]
	interval, err := metric.GetInterval()
	if err != nil {
		log.Error("Failed to parse interval", "verification_id", verificationID, "metric_index", metricIndex, "error", err)
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run first measurement immediately
	if err := s.runMeasurement(ctx, verificationID, metricIndex); err != nil {
		log.Error("Failed to run measurement", "verification_id", verificationID, "metric_index", metricIndex, "error", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Debug("Metric loop cancelled", "verification_id", verificationID, "metric_index", metricIndex)
			return
		case <-ticker.C:
			// Read fresh state from store
			verification, ok := s.store.ReleaseVerifications.Get(verificationID)
			if !ok {
				log.Warn("Verification not found in store, stopping", "verification_id", verificationID)
				return
			}

			if metricIndex >= len(verification.Metrics) {
				log.Warn("Metric index out of range, stopping", "verification_id", verificationID, "metric_index", metricIndex)
				return
			}

			// Check if this metric is complete
			metric := &verification.Metrics[metricIndex]
			measurements := metrics.NewMeasurements(metric.Measurements)
			if !measurements.ShouldContinue(metric) {
				log.Info("Metric complete, stopping loop",
					"verification_id", verificationID,
					"metric_index", metricIndex,
					"metric_name", metric.Name)
				return
			}

			// Run measurement
			if err := s.runMeasurement(ctx, verificationID, metricIndex); err != nil {
				log.Error("Failed to run measurement", "verification_id", verificationID, "metric_index", metricIndex, "error", err)
			}
		}
	}
}

// buildProviderContext creates the context needed for metric providers
func (s *Scheduler) buildProviderContext(releaseID string) (*provider.ProviderContext, error) {
	release, ok := s.store.Releases.Get(releaseID)
	if !ok {
		return nil, fmt.Errorf("release not found: %s", releaseID)
	}

	// Get the resource
	resource, _ := s.store.Resources.Get(release.ReleaseTarget.ResourceId)

	// Get the environment
	environment, _ := s.store.Environments.Get(release.ReleaseTarget.EnvironmentId)

	// Get the deployment
	deployment, _ := s.store.Deployments.Get(release.Version.DeploymentId)

	// Get variables from release
	variables := make(map[string]any)
	for k, v := range release.Variables {
		variables[k] = v
	}

	return &provider.ProviderContext{
		Release:     release,
		Resource:    resource,
		Environment: environment,
		Version:     &release.Version,
		Target:      &release.ReleaseTarget,
		Deployment:  deployment,
		Variables:   variables,
	}, nil
}

// runMeasurement executes a single measurement for a specific metric
// Reads state from store, measures, updates store
func (s *Scheduler) runMeasurement(ctx context.Context, verificationID string, metricIndex int) error {
	// Read fresh state from store
	verification, ok := s.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		return fmt.Errorf("verification not found: %s", verificationID)
	}

	if metricIndex >= len(verification.Metrics) {
		return fmt.Errorf("metric index out of range: %d", metricIndex)
	}

	metric := &verification.Metrics[metricIndex]

	log.Debug("Running measurement",
		"verification_id", verificationID,
		"metric_index", metricIndex,
		"metric_name", metric.Name,
		"release_id", verification.ReleaseId,
		"measurement_count", len(metric.Measurements))

	// Build provider context
	providerCtx, err := s.buildProviderContext(verification.ReleaseId)
	if err != nil {
		return fmt.Errorf("failed to build provider context: %w", err)
	}

	// Take measurement using the Measure function
	result, err := metrics.Measure(ctx, metric, providerCtx)

	// Update metric with result
	if err != nil {
		// Add failed measurement
		errorMsg := fmt.Sprintf("Measurement error: %s", err.Error())
		errorData := map[string]any{"error": err.Error()}
		verification.Metrics[metricIndex].Measurements = append(verification.Metrics[metricIndex].Measurements, oapi.VerificationMeasurement{
			Message:    &errorMsg,
			Passed:     false,
			MeasuredAt: time.Now(),
			Data:       &errorData,
		})
	} else {
		// Add successful measurement
		verification.Metrics[metricIndex].Measurements = append(verification.Metrics[metricIndex].Measurements, result)
	}

	// Update summary message if all metrics complete
	status := verification.Status()
	if status != oapi.ReleaseVerificationStatusRunning {
		totalMeasurements := 0
		passedMeasurements := 0
		for _, m := range verification.Metrics {
			for _, measurement := range m.Measurements {
				totalMeasurements++
				if measurement.Passed {
					passedMeasurements++
				}
			}
		}
		message := fmt.Sprintf("Verification %s: %d/%d measurements passed across %d metrics",
			status, passedMeasurements, totalMeasurements, len(verification.Metrics))
		verification.Message = &message
	}

	// Save updated verification to store
	s.store.ReleaseVerifications.Upsert(ctx, verification)

	log.Info("Metric measurement completed",
		"verification_id", verificationID,
		"metric_index", metricIndex,
		"metric_name", metric.Name,
		"release_id", verification.ReleaseId,
		"verification_status", status,
		"metric_measurement_count", len(verification.Metrics[metricIndex].Measurements))

	return nil
}
