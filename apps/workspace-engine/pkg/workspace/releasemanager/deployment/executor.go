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
	"go.opentelemetry.io/otel/codes"
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
	ctx, span := tracer.Start(ctx, "ExecuteRelease",
		trace.WithAttributes(
			attribute.String("release.id", releaseToDeploy.ID()),
			attribute.String("deployment.id", releaseToDeploy.ReleaseTarget.DeploymentId),
			attribute.String("environment.id", releaseToDeploy.ReleaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseToDeploy.ReleaseTarget.ResourceId),
			attribute.String("version.id", releaseToDeploy.Version.Id),
			attribute.String("version.tag", releaseToDeploy.Version.Tag),
		))
	defer span.End()

	// Step 1: Persist the release (WRITE)
	span.AddEvent("Persisting release to store")
	if err := e.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to persist release")
		return err
	}

	// Step 2: Create and persist new job (WRITE)
	span.AddEvent("Creating job for release")
	newJob, err := e.jobFactory.CreateJobForRelease(ctx, releaseToDeploy)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create job")
		return err
	}

	span.AddEvent("Persisting job to store")
	e.store.Jobs.Upsert(ctx, newJob)
	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", newJob.Id),
		attribute.String("job.status", string(newJob.Status)),
	)

	// Step 3: Dispatch job to integration (ASYNC)
	// Skip dispatch if job already has InvalidJobAgent status
	if newJob.Status != oapi.InvalidJobAgent {
		span.AddEvent("Dispatching job to integration (async)",
			trace.WithAttributes(attribute.String("job.id", newJob.Id)))
		
		go func() {
			if err := e.jobDispatcher.DispatchJob(ctx, newJob); err != nil && !errors.Is(err, jobs.ErrUnsupportedJobAgent) {
				log.Error("error dispatching job to integration",
					"job_id", newJob.Id,
					"error", err.Error())
				newJob.Status = oapi.InvalidIntegration
				newJob.UpdatedAt = time.Now()
				e.store.Jobs.Upsert(ctx, newJob)
			}
		}()
	} else {
		span.AddEvent("Skipping job dispatch (InvalidJobAgent status)",
			trace.WithAttributes(attribute.String("job.id", newJob.Id)))
	}

	span.SetStatus(codes.Ok, "release executed successfully")
	return nil
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
