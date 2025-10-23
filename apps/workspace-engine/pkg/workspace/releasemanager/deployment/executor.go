package deployment

import (
	"context"
	"errors"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Executor handles deployment execution (Phase 2: ACTION - Write operations).
type Executor struct {
	store         *store.Store
	jobFactory    *jobs.Factory
	jobDispatcher *jobs.Dispatcher
}

// NewExecutor creates a new deployment executor.
func NewExecutor(store *store.Store) *Executor {
	return &Executor{
		store:         store,
		jobFactory:    jobs.NewFactory(store),
		jobDispatcher: jobs.NewDispatcher(store),
	}
}

// ExecuteRelease performs all write operations to deploy a release (WRITES TO STORE).
// Precondition: Planner has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the planning phase.
func (e *Executor) ExecuteRelease(ctx context.Context, releaseToDeploy *oapi.Release) error {
	ctx, span := tracer.Start(ctx, "ExecuteRelease")
	defer span.End()

	// Step 1: Persist the release (WRITE)
	if err := e.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		return err
	}

	// Step 2: Cancel outdated jobs for this release target (WRITES)
	// Cancel any pending/in-progress jobs for different releases (outdated versions)
	e.CancelOutdatedJobs(ctx, releaseToDeploy)

	// Step 3: Create and persist new job (WRITE)
	newJob, err := e.jobFactory.CreateJobForRelease(ctx, releaseToDeploy)
	if err != nil {
		span.RecordError(err)
		return err
	}

	e.store.Jobs.Upsert(ctx, newJob)
	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", newJob.Id),
	)

	// Step 4: Dispatch job to integration (ASYNC)
	go func() {
		if err := e.jobDispatcher.DispatchJob(ctx, newJob); err != nil && !errors.Is(err, ErrUnsupportedJobAgent) {
			log.Error("error dispatching job to integration", "error", err.Error())
			newJob.Status = oapi.InvalidIntegration
			newJob.UpdatedAt = time.Now()
			e.store.Jobs.Upsert(ctx, newJob)
		}
	}()

	return nil
}

// CancelOutdatedJobs cancels jobs for outdated releases (WRITES TO STORE).
func (e *Executor) CancelOutdatedJobs(ctx context.Context, desiredRelease *oapi.Release) {
	ctx, span := tracer.Start(ctx, "CancelOutdatedJobs")
	defer span.End()

	jobs := e.store.Jobs.GetJobsForReleaseTarget(&desiredRelease.ReleaseTarget)

	for _, job := range jobs {
		if job.Status == oapi.Pending {
			job.Status = oapi.Cancelled
			job.UpdatedAt = time.Now()
			e.store.Jobs.Upsert(ctx, job)
		}
	}
}

// BuildRelease constructs a release object from its components.
func BuildRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
	variables map[string]*oapi.LiteralValue,
) *oapi.Release {
	_, span := tracer.Start(ctx, "BuildRelease",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
			attribute.String("version.id", version.Id),
			attribute.String("version.tag", version.Tag),
			attribute.String("variables.count", fmt.Sprintf("%d", len(variables))),
		))
	defer span.End()

	// Clone variables to avoid mutations affecting this release
	clonedVariables := make(map[string]oapi.LiteralValue, len(variables))
	for key, value := range variables {
		if value != nil {
			clonedVariables[key] = *value
		}
	}

	return &oapi.Release{
		ReleaseTarget:      *releaseTarget,
		Version:            *version,
		Variables:          clonedVariables,
		EncryptedVariables: []string{}, // TODO: Handle encrypted variables
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}

// ErrUnsupportedJobAgent is returned when a job agent type is not supported.
var ErrUnsupportedJobAgent = errors.New("job agent not supported")
