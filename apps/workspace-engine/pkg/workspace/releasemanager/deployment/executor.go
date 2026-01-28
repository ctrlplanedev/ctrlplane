package deployment

import (
	"context"
	"errors"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobs"
	deploymentjobs "workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/trace/token"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// Executor handles deployment execution (Phase 2: ACTION - Write operations).
type Executor struct {
	store         *store.Store
	jobFactory    *jobs.Factory
	jobDispatcher *deploymentjobs.Dispatcher
}

// NewExecutor creates a new deployment executor.
func NewExecutor(store *store.Store, verification *verification.Manager) *Executor {
	return &Executor{
		store:         store,
		jobFactory:    jobs.NewFactory(store),
		jobDispatcher: deploymentjobs.NewDispatcher(store, verification),
	}
}

// ExecuteRelease performs all write operations to deploy a release (WRITES TO STORE).
// Precondition: Planner has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the planning phase.
func (e *Executor) ExecuteRelease(ctx context.Context, releaseToDeploy *oapi.Release, recorder *trace.ReconcileTarget) (job *oapi.Job, err error) {
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
	newJob, err := e.jobFactory.CreateJobForRelease(ctx, releaseToDeploy, createJobAction)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create job")
		if createJobAction != nil {
			createJobAction.AddStep("Create job", trace.StepResultFail, fmt.Sprintf("Failed: %s", err.Error()))
		}
		return nil, err
	}

	// Set job ID on trace recorder so all subsequent spans are associated with this job
	if recorder != nil {
		recorder.SetJobID(newJob.Id)
	}

	// Generate trace token for external executors BEFORE persisting
	// This ensures the trace token is stored with the job for verification tracing
	if recorder != nil && createJobAction != nil {
		traceToken := token.GenerateDefaultTraceToken(recorder.RootTraceID(), newJob.Id)
		createJobAction.AddMetadata("trace_token", traceToken)
		createJobAction.AddMetadata("job_id", newJob.Id)
		createJobAction.AddStep("Generate trace token", trace.StepResultPass, "Token generated for external executor")

		newJob.TraceToken = &traceToken
	}

	// Persist job with trace token
	span.AddEvent("Persisting job to store")
	e.store.Jobs.Upsert(ctx, newJob)
	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", newJob.Id),
		attribute.String("job.status", string(newJob.Status)),
	)

	if createJobAction != nil {
		createJobAction.AddStep("Persist job", trace.StepResultPass, "Job persisted to store")
	}

	// Step 3: Dispatch job to integration (ASYNC)
	// Skip dispatch if job already has InvalidJobAgent status
	if newJob.Status != oapi.JobStatusInvalidJobAgent {
		span.AddEvent("Dispatching job to integration (async)",
			oteltrace.WithAttributes(attribute.String("job.id", newJob.Id)))

		if createJobAction != nil {
			createJobAction.AddStep("Dispatch job", trace.StepResultPass, "Job dispatched to integration")
		}

		go func() {
			dispatchCtx := context.WithoutCancel(ctx)
			if err := e.jobDispatcher.DispatchJob(dispatchCtx, newJob); err != nil && !errors.Is(err, deploymentjobs.ErrUnsupportedJobAgent) {
				message := fmt.Sprintf("Failed to dispatch job to integration: %s", err.Error())
				log.Error("error dispatching job to integration",
					"job_id", newJob.Id,
					"error", err.Error(),
					"message", message)
				newJob.Status = oapi.JobStatusInvalidJobAgent
				newJob.UpdatedAt = time.Now()
				newJob.Message = &message
				e.store.Jobs.Upsert(dispatchCtx, newJob)
			}
		}()
	} else {
		span.AddEvent("Skipping job dispatch (InvalidJobAgent status)",
			oteltrace.WithAttributes(attribute.String("job.id", newJob.Id)))
		if createJobAction != nil {
			createJobAction.AddStep("Skipping dispatch, unable to process job configuration.", trace.StepResultFail, "Job has InvalidJobAgent status")
		}
	}

	// End the action
	if createJobAction != nil {
		createJobAction.End()
	}

	span.SetStatus(codes.Ok, "release executed successfully")
	return newJob, nil
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
