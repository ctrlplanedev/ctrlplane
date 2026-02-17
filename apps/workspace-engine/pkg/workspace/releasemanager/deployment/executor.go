package deployment

import (
	"context"
	"fmt"
	"strings"
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

func agentNames(agents []*oapi.JobAgent) []string {
	names := make([]string, len(agents))
	for i, a := range agents {
		names[i] = a.Name
	}
	return names
}

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

func (e *Executor) dispatchJobForAgent(ctx context.Context, release *oapi.Release, agent *oapi.JobAgent) (*oapi.Job, error) {
	_, span := tracer.Start(ctx, "createJobForAgent",
		oteltrace.WithAttributes(
			attribute.String("agent.id", agent.Id),
			attribute.String("agent.name", agent.Name),
			attribute.String("agent.type", agent.Type),
		))
	defer span.End()

	newJob, err := e.jobFactory.CreateJobForRelease(ctx, release, agent, nil)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create job")
		return nil, err
	}

	e.store.Jobs.Upsert(ctx, newJob)

	if newJob.Status == oapi.JobStatusInvalidJobAgent {
		span.AddEvent("Skipping job dispatch (InvalidJobAgent status)",
			oteltrace.WithAttributes(attribute.String("job.id", newJob.Id)))
		return newJob, nil
	}

	if err := e.jobAgentRegistry.Dispatch(ctx, newJob); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to dispatch job")
		return nil, err
	}

	return newJob, nil
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

	var execution *trace.ExecutionPhase
	if recorder != nil {
		execution = recorder.StartExecution()
		defer execution.End()
	}

	if err := e.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to persist release")
		return nil, err
	}

	deployment, exists := e.store.Deployments.Get(releaseToDeploy.ReleaseTarget.DeploymentId)
	if !exists {
		return nil, fmt.Errorf("deployment %s not found", releaseToDeploy.ReleaseTarget.DeploymentId)
	}

	agents, err := jobagents.NewDeploymentAgentsSelector(e.store, deployment, releaseToDeploy).SelectAgents()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get deployment agents")
		failedJob := e.jobFactory.InvalidDeploymentAgentsJob(releaseToDeploy.ID(), deployment.Name, nil)
		e.store.Jobs.Upsert(ctx, failedJob)
		return []*oapi.Job{failedJob}, nil
	}

	if execution != nil {
		execution.TriggerJob("create_jobs_for_deployment_agents", map[string]string{
			"deployment_id":  deployment.Id,
			"environment_id": releaseToDeploy.ReleaseTarget.EnvironmentId,
			"resource_id":    releaseToDeploy.ReleaseTarget.ResourceId,
			"version_id":     releaseToDeploy.Version.Id,
			"version_tag":    releaseToDeploy.Version.Tag,
			"agents":         strings.Join(agentNames(agents), ","),
		})
	}

	if len(agents) == 0 {
		failedJob := e.jobFactory.NoAgentConfiguredJob(releaseToDeploy.ID(), "", deployment.Name, nil)
		e.store.Jobs.Upsert(ctx, failedJob)
		return []*oapi.Job{failedJob}, nil
	}

	newJobs := make([]*oapi.Job, 0)
	for _, agent := range agents {
		newJob, err := e.dispatchJobForAgent(ctx, releaseToDeploy, agent)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to create job")
			return nil, err
		}

		newJobs = append(newJobs, newJob)
	}

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
