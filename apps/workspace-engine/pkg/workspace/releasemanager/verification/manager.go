package verification

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/verification")

// Manager handles post-deployment verification of jobs
// It uses a scheduler to run verifications from the store
type Manager struct {
	store     *store.Store
	scheduler *scheduler
	hooks     VerificationHooks
}

func NewManager(store *store.Store, opts ...ManagerOption) *Manager {
	m := &Manager{
		store: store,
		hooks: DefaultHooks(),
	}
	for _, opt := range opts {
		opt(m)
	}

	m.scheduler = newScheduler(store, m.hooks)
	return m
}

func (m *Manager) SetHooks(hooks VerificationHooks) {
	m.hooks = hooks
	m.scheduler = newScheduler(m.store, hooks)
}

type ManagerOption func(*Manager)

func WithHooks(hooks VerificationHooks) ManagerOption {
	return func(m *Manager) {
		m.hooks = hooks
	}
}

// OnLoad restarts goroutines for any unfinished verifications
// This should be called when the application starts to resume any in-progress verifications
func (m *Manager) Restore(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "VerificationManager.Restore")
	defer span.End()

	// Get all verifications from the store
	allVerifications := m.store.JobVerifications.Items()

	restarted := 0
	for _, verification := range allVerifications {
		// Check if verification is not finished
		status := verification.Status()
		if status != oapi.JobVerificationStatusPassed &&
			status != oapi.JobVerificationStatusFailed &&
			status != oapi.JobVerificationStatusCancelled {
			// Restart the verification goroutines
			m.scheduler.StartVerification(ctx, verification.Id)
			restarted++
			log.Info("Restarted verification on load",
				"verification_id", verification.Id,
				"job_id", verification.JobId,
				"status", status,
				"metric_count", len(verification.Metrics))
		}
	}

	span.SetAttributes(attribute.Int("restarted_count", restarted))
	span.SetStatus(codes.Ok, "verifications loaded")

	if restarted > 0 {
		log.Info("Restarted verifications on load", "count", restarted)
	}

	return nil
}

// StartVerification creates a new verification and starts goroutines to run measurements
func (m *Manager) StartVerification(
	ctx context.Context,
	job *oapi.Job,
	metrics []oapi.VerificationMetricSpec,
) error {
	ctx, span := tracer.Start(ctx, "StartVerification",
		trace.WithAttributes(
			attribute.String("job.id", job.Id),
			attribute.String("release.id", job.ReleaseId),
		))
	defer span.End()

	// Require metric configuration
	if len(metrics) == 0 {
		return fmt.Errorf("at least one metric configuration is required for verification")
	}

	// Convert VerificationMetricSpecs to VerificationMetricStatus with empty measurements
	metricStatuses := make([]oapi.VerificationMetricStatus, len(metrics))
	for i, metric := range metrics {
		metricStatuses[i] = oapi.VerificationMetricStatus{
			Name:             metric.Name,
			IntervalSeconds:  metric.IntervalSeconds,
			Count:            metric.Count,
			SuccessCondition: metric.SuccessCondition,
			FailureThreshold: metric.FailureThreshold,
			FailureCondition: metric.FailureCondition,
			SuccessThreshold: metric.SuccessThreshold,
			Provider:         metric.Provider,
			Measurements:     []oapi.VerificationMeasurement{},
		}
	}

	verificationRecord := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     job.Id,
		Metrics:   metricStatuses,
		CreatedAt: time.Now(),
	}

	// Store the verification
	m.store.JobVerifications.Upsert(ctx, verificationRecord)

	// Start goroutine for this verification
	m.scheduler.StartVerification(ctx, verificationRecord.Id)

	// Call hook after verification is started
	if err := m.hooks.OnVerificationStarted(ctx, verificationRecord); err != nil {
		log.Error("Verification started hook failed",
			"verification_id", verificationRecord.Id,
			"error", err)
		// Don't fail the verification due to hook errors
	}

	span.SetAttributes(attribute.String("verification.status", "created"))
	span.SetStatus(codes.Ok, "verification created")

	log.Info("Created verification for job",
		"job_id", job.Id,
		"release_id", job.ReleaseId,
		"verification_id", verificationRecord.Id,
		"metric_count", len(metrics))

	return nil
}

// StopVerificationsForJob cancels all verifications for a job and stops their goroutines
func (m *Manager) StopVerificationsForJob(ctx context.Context, jobID string) {
	ctx, span := tracer.Start(ctx, "StopVerificationsForJob",
		trace.WithAttributes(
			attribute.String("job.id", jobID),
		))
	defer span.End()

	verifications := m.store.JobVerifications.GetByJobId(jobID)
	for _, verification := range verifications {
		// Stop the goroutines
		m.scheduler.StopVerification(verification.Id)

		// Call hook after verification is stopped
		if err := m.hooks.OnVerificationStopped(ctx, verification); err != nil {
			log.Error("Verification stopped hook failed",
				"verification_id", verification.Id,
				"error", err)
			// Don't fail the stop operation due to hook errors
		}

		log.Info("Stopped verification for job",
			"job_id", jobID,
			"verification_id", verification.Id)
	}

	span.SetStatus(codes.Ok, "verifications stopped")
}
