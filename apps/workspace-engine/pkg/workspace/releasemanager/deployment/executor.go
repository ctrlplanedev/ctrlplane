package deployment

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/jobs"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// Executor handles deployment execution (Phase 2: ACTION - Write operations).
type Executor struct {
	store            *store.Store
	jobFactory       *jobs.Factory
	jobAgentRegistry *jobagents.Registry
}

// NewExecutor creates a new deployment executor.
func NewExecutor(store *store.Store, jobAgentRegistry *jobagents.Registry) *Executor {
	return &Executor{
		store:            store,
		jobFactory:       jobs.NewFactory(store),
		jobAgentRegistry: jobAgentRegistry,
	}
}

// ExecuteRelease performs all write operations to deploy a release (WRITES TO STORE).
// Precondition: Planner has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the planning phase.
func (e *Executor) ExecuteRelease(ctx context.Context, releaseToDeploy *oapi.Release, recorder *trace.ReconcileTarget) ([]*oapi.Job, error) {
	ctx, span := tracer.Start(ctx, "ExecuteRelease",
		oteltrace.WithAttributes(
			attribute.String("release.id", releaseToDeploy.ID()),
			attribute.String("deployment.id", releaseToDeploy.ReleaseTarget.DeploymentId),
			attribute.String("environment.id", releaseToDeploy.ReleaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseToDeploy.ReleaseTarget.ResourceId),
			attribute.String("version.id", releaseToDeploy.Version.Id),
			attribute.String("version.tag", releaseToDeploy.Version.Tag),
		))
	defer span.End()

	// Start execution phase trace if recorder is available
	var execution *trace.ExecutionPhase
	if recorder != nil {
		execution = recorder.StartExecution()
		defer execution.End()
	}

	// Start action for job creation
	var createJobAction *trace.Action
	if execution != nil {
		createJobAction = recorder.StartAction("Create and dispatch job")
	}

	if err := e.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to persist release")
		if createJobAction != nil {
			createJobAction.AddStep("Persist release", trace.StepResultFail, fmt.Sprintf("Failed: %s", err.Error()))
		}
		return nil, err
	}

	// Step 2: Create and persist new job (WRITE)
	span.AddEvent("Creating job for release")
	newJobs, err := e.jobFactory.CreateJobsForRelease(ctx, releaseToDeploy, createJobAction)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create job")
		if createJobAction != nil {
			createJobAction.AddStep("Create job", trace.StepResultFail, fmt.Sprintf("Failed: %s", err.Error()))
		}
		return nil, err
	}

	// Persist job with trace token
	span.AddEvent("Persisting job to store")
	for _, job := range newJobs {
		e.store.Jobs.Upsert(ctx, job)
	}

	if createJobAction != nil {
		createJobAction.AddStep("Persist job", trace.StepResultPass, "Job persisted to store")
	}

	// Step 3: Dispatch job to integration (ASYNC)
	// Skip dispatch if job already has InvalidJobAgent status
	for _, newJob := range newJobs {
		if newJob.Status != oapi.JobStatusInvalidJobAgent {
			span.AddEvent("Dispatching job to integration (async)",
				oteltrace.WithAttributes(attribute.String("job.id", newJob.Id)))

			if createJobAction != nil {
				createJobAction.AddStep("Dispatch job", trace.StepResultPass, "Job dispatched to integration")
			}

			if err := e.jobAgentRegistry.Dispatch(ctx, newJob); err != nil {
				message := fmt.Sprintf("Failed to dispatch job to integration: %s", err.Error())
				newJob.Status = oapi.JobStatusInvalidJobAgent
				newJob.UpdatedAt = time.Now()
				newJob.Message = &message
				e.store.Jobs.Upsert(ctx, newJob)
			}
		} else {
			span.AddEvent("Skipping job dispatch (InvalidJobAgent status)",
				oteltrace.WithAttributes(attribute.String("job.id", newJob.Id)))
			if createJobAction != nil {
				createJobAction.AddStep("Skipping dispatch, unable to process job configuration.", trace.StepResultFail, "Job has InvalidJobAgent status")
			}
		}
	}

	// End the action
	if createJobAction != nil {
		createJobAction.End()
	}

	span.SetStatus(codes.Ok, "release executed successfully")
	return newJobs, nil
}

// BuildRelease constructs a release object from its components.
func BuildRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
	variables map[string]*oapi.LiteralValue,
) *oapi.Release {
	_, span := tracer.Start(ctx, "BuildRelease",
		oteltrace.WithAttributes(
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
