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
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/verification")

// Manager handles post-deployment verification of releases
// It monitors deployed releases and can mark versions as rejected if verification fails
type Manager struct {
	store *store.Store

	// Active verifications being monitored
	activeVerifications sync.Map // map[releaseID]*VerificationRun
}

// VerificationRun represents an active verification process for a release
type VerificationRun struct {
	Release      *oapi.Release
	Verification *Verification
	Analysis     *metrics.Analysis
	CancelFunc   context.CancelFunc
	StartedAt    time.Time
	LastCheckAt  time.Time
	Status       VerificationStatus
}

type VerificationStatus string

const (
	VerificationStatusRunning   VerificationStatus = "running"
	VerificationStatusPassed    VerificationStatus = "passed"
	VerificationStatusFailed    VerificationStatus = "failed"
	VerificationStatusCancelled VerificationStatus = "cancelled"
)

func NewManager(store *store.Store) *Manager {
	return &Manager{
		store: store,
	}
}

// StartVerification begins monitoring a release after it has been deployed successfully
// This should be called after a job completes with status=successful
func (m *Manager) StartVerification(
	ctx context.Context,
	release *oapi.Release,
	verification *Verification,
) error {
	ctx, span := tracer.Start(ctx, "StartVerification",
		trace.WithAttributes(
			attribute.String("release.id", release.ID()),
			attribute.String("version.id", release.Version.Id),
			attribute.String("version.tag", release.Version.Tag),
		))
	defer span.End()

	releaseID := release.ID()

	// Check if verification is already running for this release
	if _, exists := m.activeVerifications.Load(releaseID); exists {
		span.AddEvent("Verification already running for release")
		return nil
	}

	// Create a cancellable context for this verification
	verificationCtx, cancel := context.WithCancel(context.Background())

	run := &VerificationRun{
		Release:      release,
		Verification: verification,
		Analysis:     metrics.NewAnalysis(),
		CancelFunc:   cancel,
		StartedAt:    time.Now(),
		LastCheckAt:  time.Now(),
		Status:       VerificationStatusRunning,
	}

	m.activeVerifications.Store(releaseID, run)

	// Start verification in background
	go m.runVerification(verificationCtx, run)

	span.SetAttributes(attribute.String("verification.status", "started"))
	span.SetStatus(codes.Ok, "verification started")

	log.Info("Started verification for release",
		"release_id", releaseID,
		"version", release.Version.Tag,
		"environment", release.ReleaseTarget.EnvironmentId)

	return nil
}

// StopVerification cancels an active verification for a release
func (m *Manager) StopVerification(releaseID string) {
	if runInterface, exists := m.activeVerifications.Load(releaseID); exists {
		run := runInterface.(*VerificationRun)
		run.CancelFunc()
		run.Status = VerificationStatusCancelled
		m.activeVerifications.Delete(releaseID)
		
		log.Info("Stopped verification for release", "release_id", releaseID)
	}
}

// GetVerificationStatus returns the current status of verification for a release
func (m *Manager) GetVerificationStatus(releaseID string) *VerificationRun {
	if runInterface, exists := m.activeVerifications.Load(releaseID); exists {
		return runInterface.(*VerificationRun)
	}
	return nil
}

// runVerification executes the verification process for a release
// This runs continuously until the verification passes, fails, or is cancelled
func (m *Manager) runVerification(ctx context.Context, run *VerificationRun) {
	ctx, span := tracer.Start(ctx, "runVerification",
		trace.WithAttributes(
			attribute.String("release.id", run.Release.ID()),
			attribute.String("version.id", run.Release.Version.Id),
		))
	defer span.End()

	releaseID := run.Release.ID()

	defer func() {
		m.activeVerifications.Delete(releaseID)
		span.AddEvent("Verification completed")
	}()

	// Get the metric from verification config
	metric := run.Verification.Metric

	// Build provider context for metrics
	providerCtx := m.buildProviderContext(run.Release)

	for {
		select {
		case <-ctx.Done():
			run.Status = VerificationStatusCancelled
			span.AddEvent("Verification cancelled")
			return

		default:
			// Take a measurement
			result, err := metric.Measure(ctx, providerCtx)
			if err != nil {
				log.Error("Verification measurement failed",
					"release_id", releaseID,
					"error", err)
				
				// Add failed measurement
				run.Analysis.Measurements = append(run.Analysis.Measurements, &metrics.Result{
					Message: fmt.Sprintf("Measurement error: %s", err.Error()),
					Passed:  false,
					Measurement: &metrics.Measurement{
						MeasuredAt: time.Now(),
						Data:       map[string]any{"error": err.Error()},
					},
				})
			} else {
				run.Analysis.Measurements = append(run.Analysis.Measurements, result)
			}

			run.LastCheckAt = time.Now()

			// Determine verification status
			phase := run.Analysis.Phase(metric)

			span.AddEvent("Measurement taken",
				trace.WithAttributes(
					attribute.String("phase", string(phase)),
					attribute.Int("passed_count", run.Analysis.PassedCount()),
					attribute.Int("failed_count", run.Analysis.FailedCount()),
					attribute.Int("total_count", len(run.Analysis.Measurements)),
				))

			switch phase {
			case metrics.Passed:
				run.Status = VerificationStatusPassed
				span.SetStatus(codes.Ok, "verification passed")
				
				log.Info("Verification passed for release",
					"release_id", releaseID,
					"version", run.Release.Version.Tag,
					"passed_count", run.Analysis.PassedCount(),
					"total_count", len(run.Analysis.Measurements))
				
				return

			case metrics.Failed:
				run.Status = VerificationStatusFailed
				span.SetStatus(codes.Error, "verification failed")
				
				log.Warn("Verification failed for release",
					"release_id", releaseID,
					"version", run.Release.Version.Id,
					"failed_count", run.Analysis.FailedCount(),
					"total_count", len(run.Analysis.Measurements))
				
				// Mark version as rejected
				m.markVersionAsRejected(context.Background(), run.Release.Version.Id, "Verification failed")
				
				return

			case metrics.Running:
				// Continue monitoring
				if !run.Analysis.ShouldContinue(metric) {
					// Should have stopped by now
					run.Status = VerificationStatusFailed
					return
				}
				
				// Wait for the interval before next measurement
				select {
				case <-ctx.Done():
					run.Status = VerificationStatusCancelled
					return
				case <-time.After(metric.Interval):
					// Continue to next measurement
				}
			}
		}
	}
}

// markVersionAsRejected marks a deployment version as rejected
// This will trigger the system to stop deploying this version and potentially rollback
func (m *Manager) markVersionAsRejected(ctx context.Context, versionID string, reason string) {
	ctx, span := tracer.Start(ctx, "markVersionAsRejected",
		trace.WithAttributes(
			attribute.String("version.id", versionID),
			attribute.String("reason", reason),
		))
	defer span.End()

	version, ok := m.store.DeploymentVersions.Get(versionID)
	if !ok {
		span.RecordError(fmt.Errorf("version not found: %s", versionID))
		span.SetStatus(codes.Error, "version not found")
		return
	}

	// Update version status to rejected
	version.Status = oapi.DeploymentVersionStatusRejected
	message := reason
	version.Message = &message

	m.store.DeploymentVersions.Upsert(ctx, versionID, version)

	span.SetStatus(codes.Ok, "version marked as rejected")
	
	log.Warn("Marked version as rejected",
		"version_id", versionID,
		"version_tag", version.Tag,
		"reason", reason)
}

// buildProviderContext creates the context needed for metric providers
func (m *Manager) buildProviderContext(release *oapi.Release) *metrics.ProviderContext {
	// Get the resource
	resource, _ := m.store.Resources.Get(release.ReleaseTarget.ResourceId)

	// Get the environment
	environment, _ := m.store.Environments.Get(release.ReleaseTarget.EnvironmentId)

	// Get the deployment
	deployment, _ := m.store.Deployments.Get(release.Version.DeploymentId)

	// Get variables from release
	variables := make(map[string]any)
	for k, v := range release.Variables {
		variables[k] = v
	}

	return &metrics.ProviderContext{
		Release:     release,
		Resource:    resource,
		Environment: environment,
		Version:     &release.Version,
		Target:      &release.ReleaseTarget,
		Deployment:  deployment,
		Variables:   variables,
	}
}

