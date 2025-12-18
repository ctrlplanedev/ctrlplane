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

// Manager handles post-deployment verification of releases
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
	allVerifications := m.store.ReleaseVerifications.Items()

	restarted := 0
	for _, verification := range allVerifications {
		// Check if verification is not finished
		status := verification.Status()
		if status != oapi.ReleaseVerificationStatusPassed &&
			status != oapi.ReleaseVerificationStatusFailed &&
			status != oapi.ReleaseVerificationStatusCancelled {
			// Restart the verification goroutines
			m.scheduler.StartVerification(ctx, verification.Id)
			restarted++
			log.Info("Restarted verification on load",
				"verification_id", verification.Id,
				"release_id", verification.ReleaseId,
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
	release *oapi.Release,
	job *oapi.Job,
	metrics []oapi.VerificationMetricSpec,
) error {
	ctx, span := tracer.Start(ctx, "StartVerification",
		trace.WithAttributes(
			attribute.String("release.id", release.ID()),
			attribute.String("version.id", release.Version.Id),
			attribute.String("version.tag", release.Version.Tag),
		))
	defer span.End()

	releaseID := release.ID()

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
			SuccessThreshold: metric.SuccessThreshold,
			Provider:         metric.Provider,
			Measurements:     []oapi.VerificationMeasurement{},
		}
	}

	verificationRecord := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseID,
		Metrics:   metricStatuses,
		CreatedAt: time.Now(),
	}

	if job != nil {
		verificationRecord.JobId = &job.Id
	}

	// Store the verification
	m.store.ReleaseVerifications.Upsert(ctx, verificationRecord)

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

	log.Info("Created verification for release",
		"release_id", releaseID,
		"verification_id", verificationRecord.Id,
		"version", release.Version.Tag,
		"environment", release.ReleaseTarget.EnvironmentId,
		"metric_count", len(metrics))

	return nil
}

// StopVerification cancels a verification and stops its goroutines
func (m *Manager) StopVerification(ctx context.Context, releaseID string) {
	ctx, span := tracer.Start(ctx, "StopVerification",
		trace.WithAttributes(
			attribute.String("release.id", releaseID),
		))
	defer span.End()

	if verification, exists := m.store.ReleaseVerifications.GetByReleaseId(releaseID); exists {
		// Stop the goroutines
		m.scheduler.StopVerification(verification.Id)

		// Call hook after verification is stopped
		if err := m.hooks.OnVerificationStopped(ctx, verification); err != nil {
			log.Error("Verification stopped hook failed",
				"verification_id", verification.Id,
				"error", err)
			// Don't fail the stop operation due to hook errors
		}

		span.SetStatus(codes.Ok, "verification stopped")
		log.Info("Stopped verification for release",
			"release_id", releaseID,
			"verification_id", verification.Id)
	} else {
		span.SetStatus(codes.Error, "verification not found")
	}
}
