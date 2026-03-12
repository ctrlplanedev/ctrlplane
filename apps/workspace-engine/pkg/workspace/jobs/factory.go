// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"
)

var tracer = otel.Tracer("workspace/releasemanager/jobs")

type Getters interface {
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error)
}

// Factory creates jobs for releases.
type Factory struct {
	getters Getters
}

// NewFactory creates a new job factory.
func NewFactory(store *store.Store) *Factory {
	return &Factory{
		getters: NewStoreGetters(store),
	}
}

func NewFactoryFromGetters(getters Getters) *Factory {
	return &Factory{
		getters: getters,
	}
}

// NoAgentConfiguredJob creates a job for a release with no job agent configured.
func (f *Factory) NoAgentConfiguredJob(
	releaseID, jobAgentID, deploymentName string,
	action *trace.Action,
) *oapi.Job {
	message := fmt.Sprintf("No job agent configured for deployment '%s'", deploymentName)
	if action != nil {
		action.AddStep(
			"Create InvalidJobAgent job",
			trace.StepResultPass,
			fmt.Sprintf(
				"Created InvalidJobAgent job for release %s with job agent %s",
				releaseID,
				jobAgentID,
			),
		).
			AddMetadata("release_id", releaseID).
			AddMetadata("job_agent_id", jobAgentID).
			AddMetadata("message", message)
	}

	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         oapi.JobStatusInvalidJobAgent,
		Message:        &message,
		CreatedAt:      now,
		UpdatedAt:      now,
		CompletedAt:    &now,
		Metadata:       make(map[string]string),
	}
}

// InvalidDeploymentAgentsJob creates a job for a release with invalid deployment agents.
func (f *Factory) InvalidDeploymentAgentsJob(
	releaseID, deploymentName string,
	action *trace.Action,
) *oapi.Job {
	message := fmt.Sprintf("Invalid deployment agents for deployment '%s'", deploymentName)
	if action != nil {
		action.AddStep(
			"Create InvalidDeploymentAgentsJob job",
			trace.StepResultPass,
			fmt.Sprintf(
				"Created InvalidDeploymentAgentsJob job for release %s with deployment %s",
				releaseID,
				deploymentName,
			),
		).
			AddMetadata("release_id", releaseID).
			AddMetadata("deployment_name", deploymentName).
			AddMetadata("message", message)
	}

	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      releaseID,
		JobAgentId:     "",
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         oapi.JobStatusInvalidJobAgent,
		Message:        &message,
		CreatedAt:      now,
		UpdatedAt:      now,
		CompletedAt:    &now,
		Metadata:       make(map[string]string),
	}
}

// BuildDispatchContext builds a dispatch context for a release, fetching
// environment and resource via the factory's getters. The jobAgent is optional
// and may be nil for failure jobs where no agent is available.
func (f *Factory) BuildDispatchContext(
	ctx context.Context,
	release *oapi.Release,
	deployment *oapi.Deployment,
	jobAgent *oapi.JobAgent,
) (*oapi.DispatchContext, error) {
	environmentID, err := uuid.Parse(release.ReleaseTarget.EnvironmentId)
	if err != nil {
		return nil, fmt.Errorf("failed to parse environment id: %w", err)
	}
	environment, err := f.getters.GetEnvironment(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get environment: %w", err)
	}

	resourceID, err := uuid.Parse(release.ReleaseTarget.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("failed to parse resource id: %w", err)
	}
	resource, err := f.getters.GetResource(ctx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource: %w", err)
	}

	dc := &oapi.DispatchContext{
		Release:     release,
		Deployment:  deployment,
		Environment: environment,
		Resource:    resource,
		Version:     &release.Version,
		Variables:   &release.Variables,
	}
	if jobAgent != nil {
		dc.JobAgent = *jobAgent
		dc.JobAgentConfig = jobAgent.Config
	}

	return dc, nil
}

// CreateJobForRelease creates a job for a given release (PURE FUNCTION, NO WRITES).
// The job uses the resolved settings already present on the selected job agent.
func (f *Factory) CreateJobForRelease(
	ctx context.Context,
	release *oapi.Release,
	jobAgent *oapi.JobAgent,
) (*oapi.Job, error) {
	_, span := tracer.Start(ctx, "CreateJobForRelease",
		oteltrace.WithAttributes(
			attribute.String("deployment.id", release.ReleaseTarget.DeploymentId),
			attribute.String("environment.id", release.ReleaseTarget.EnvironmentId),
			attribute.String("resource.id", release.ReleaseTarget.ResourceId),
			attribute.String("version.id", release.Version.Id),
			attribute.String("version.tag", release.Version.Tag),
		))
	defer span.End()

	releaseTarget := release.ReleaseTarget

	// Lookup deployment
	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return nil, fmt.Errorf("failed to parse deployment id: %w", err)
	}
	deployment, err := f.getters.GetDeployment(ctx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment: %w", err)
	}
	jobId := uuid.New().String()

	dispatchContext, err := f.BuildDispatchContext(ctx, release, deployment, jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to build dispatch context: %w", err)
	}

	return &oapi.Job{
		Id:              jobId,
		ReleaseId:       release.Id.String(),
		JobAgentId:      jobAgent.Id,
		JobAgentConfig:  jobAgent.Config,
		Status:          oapi.JobStatusPending,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		Metadata:        make(map[string]string),
		DispatchContext: dispatchContext,
	}, nil
}
