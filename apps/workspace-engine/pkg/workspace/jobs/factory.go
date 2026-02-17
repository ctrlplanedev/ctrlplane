// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/jobs")

// Factory creates jobs for releases.
type Factory struct {
	store *store.Store
}

// NewFactory creates a new job factory.
func NewFactory(store *store.Store) *Factory {
	return &Factory{
		store: store,
	}
}

func (f *Factory) NoAgentConfiguredJob(releaseID, jobAgentID, deploymentName string, action *trace.Action) *oapi.Job {
	message := fmt.Sprintf("No job agent configured for deployment '%s'", deploymentName)
	if action != nil {
		action.AddStep("Create InvalidJobAgent job", trace.StepResultPass,
			fmt.Sprintf("Created InvalidJobAgent job for release %s with job agent %s", releaseID, jobAgentID)).
			AddMetadata("release_id", releaseID).
			AddMetadata("job_agent_id", jobAgentID).
			AddMetadata("message", message)
	}

	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         oapi.JobStatusInvalidJobAgent,
		Message:        &message,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       make(map[string]string),
	}
}

func (f *Factory) jobAgentNotFoundJob(releaseID, jobAgentID, deploymentName string, action *trace.Action) *oapi.Job {
	message := fmt.Sprintf("Job agent '%s' not found for deployment '%s'", jobAgentID, deploymentName)
	if action != nil {
		action.AddStep("Create NoAgentFoundJob job", trace.StepResultPass,
			fmt.Sprintf("Created NoAgentFoundJob job for release %s with job agent %s", releaseID, jobAgentID)).
			AddMetadata("release_id", releaseID).
			AddMetadata("job_agent_id", jobAgentID).
			AddMetadata("message", message)
	}

	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         oapi.JobStatusInvalidJobAgent,
		Message:        &message,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       make(map[string]string),
	}
}

func (f *Factory) buildJobAgentConfig(release *oapi.Release, deployment *oapi.Deployment, jobAgent *oapi.JobAgent) (oapi.JobAgentConfig, error) {
	agentConfig := jobAgent.Config
	deploymentConfig := deployment.JobAgentConfig
	versionConfig := release.Version.JobAgentConfig

	mergedConfig, err := mergeJobAgentConfig(agentConfig, deploymentConfig, versionConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to merge job agent configs: %w", err)
	}

	return mergedConfig, nil
}

func (f *Factory) buildDispatchContext(release *oapi.Release, deployment *oapi.Deployment, jobAgent *oapi.JobAgent, mergedConfig oapi.JobAgentConfig) (*oapi.DispatchContext, error) {
	environment, exists := f.store.Environments.Get(release.ReleaseTarget.EnvironmentId)
	if !exists {
		return nil, fmt.Errorf("environment %s not found", release.ReleaseTarget.EnvironmentId)
	}
	envCopy, err := deepCopy(environment)
	if err != nil {
		return nil, fmt.Errorf("failed to copy environment: %w", err)
	}

	resource, exists := f.store.Resources.Get(release.ReleaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %s not found", release.ReleaseTarget.ResourceId)
	}
	resourceCopy, err := deepCopy(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to copy resource: %w", err)
	}

	releaseCopy, err := deepCopy(release)
	if err != nil {
		return nil, fmt.Errorf("failed to copy release: %w", err)
	}

	deploymentCopy, err := deepCopy(deployment)
	if err != nil {
		return nil, fmt.Errorf("failed to copy deployment: %w", err)
	}

	agentCopy, err := deepCopy(jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to copy job agent: %w", err)
	}

	return &oapi.DispatchContext{
		Release:        releaseCopy,
		Deployment:     deploymentCopy,
		Environment:    envCopy,
		Resource:       resourceCopy,
		JobAgent:       *agentCopy,
		JobAgentConfig: mergedConfig,
		Version:        &releaseCopy.Version,
		Variables:      &releaseCopy.Variables,
	}, nil
}

// CreateJobForRelease creates a job for a given release (PURE FUNCTION, NO WRITES).
// The job is configured with merged settings from JobAgent + Deployment.
func (f *Factory) CreateJobForRelease(ctx context.Context, release *oapi.Release, jobAgent *oapi.JobAgent, action *trace.Action) (*oapi.Job, error) {
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
	deployment, exists := f.store.Deployments.Get(releaseTarget.DeploymentId)
	if !exists {
		return nil, fmt.Errorf("deployment %s not found", releaseTarget.DeploymentId)
	}

	if action != nil {
		action.AddStep("Lookup deployment", trace.StepResultPass,
			fmt.Sprintf("Found deployment: %s (%s)", deployment.Name, deployment.Slug)).
			AddMetadata("deployment_id", deployment.Id).
			AddMetadata("deployment_name", deployment.Name)
	}

	if action != nil {
		action.AddStep("Validate job agent", trace.StepResultPass,
			fmt.Sprintf("Job agent '%s' (type: %s) found and validated", jobAgent.Name, jobAgent.Type)).
			AddMetadata("job_agent_id", jobAgent.Id).
			AddMetadata("job_agent_name", jobAgent.Name).
			AddMetadata("job_agent_type", jobAgent.Type)
	}

	if action != nil {
		configMsg := "Applied default job agent configuration"

		action.AddStep("Configure job", trace.StepResultPass, configMsg)
	}

	jobId := uuid.New().String()

	if action != nil {
		action.AddStep("Create job", trace.StepResultPass,
			fmt.Sprintf("Job created successfully with ID %s for release %s", jobId, release.ID())).
			AddMetadata("job_id", jobId).
			AddMetadata("job_status", string(oapi.JobStatusPending)).
			AddMetadata("job_agent_id", jobAgent.Id).
			AddMetadata("release_id", release.ID()).
			AddMetadata("version_tag", release.Version.Tag)
	}

	mergedConfig, err := f.buildJobAgentConfig(release, deployment, jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to get merged job agent config: %w", err)
	}

	dispatchContext, err := f.buildDispatchContext(release, deployment, jobAgent, mergedConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build dispatch context: %w", err)
	}

	return &oapi.Job{
		Id:              jobId,
		ReleaseId:       release.ID(),
		JobAgentId:      jobAgent.Id,
		JobAgentConfig:  mergedConfig,
		Status:          oapi.JobStatusPending,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		Metadata:        make(map[string]string),
		DispatchContext: dispatchContext,
	}, nil
}

func (f *Factory) buildWorkflowJobConfig(wfJob *oapi.WorkflowJob, jobAgent *oapi.JobAgent) (oapi.JobAgentConfig, error) {
	agentConfig := jobAgent.Config
	workflowJobConfig := wfJob.Config
	mergedConfig, err := mergeJobAgentConfig(agentConfig, workflowJobConfig)
	if err != nil {
		return oapi.JobAgentConfig{}, fmt.Errorf("failed to merge job agent configs: %w", err)
	}
	return mergedConfig, nil
}

func (f *Factory) buildWorkflowJobDispatchContext(wfJob *oapi.WorkflowJob, jobAgent *oapi.JobAgent, mergedConfig oapi.JobAgentConfig) (*oapi.DispatchContext, error) {
	jobAgentCopy, err := deepCopy(jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to copy job agent: %w", err)
	}

	workflowJobCopy, err := deepCopy(wfJob)
	if err != nil {
		return nil, fmt.Errorf("failed to copy workflow job: %w", err)
	}

	workflowRun, exists := f.store.WorkflowRuns.Get(wfJob.WorkflowRunId)
	if !exists {
		return nil, fmt.Errorf("workflow run %s not found", wfJob.WorkflowRunId)
	}
	workflowRunCopy, err := deepCopy(workflowRun)
	if err != nil {
		return nil, fmt.Errorf("failed to copy workflow run: %w", err)
	}

	workflow, exists := f.store.Workflows.Get(workflowRun.WorkflowId)
	if !exists {
		return nil, fmt.Errorf("workflow %s not found", workflowRun.WorkflowId)
	}
	workflowCopy, err := deepCopy(workflow)
	if err != nil {
		return nil, fmt.Errorf("failed to copy workflow: %w", err)
	}

	return &oapi.DispatchContext{
		WorkflowJob:    workflowJobCopy,
		JobAgent:       *jobAgentCopy,
		JobAgentConfig: mergedConfig,
		WorkflowRun:    workflowRunCopy,
		Workflow:       workflowCopy,
	}, nil
}

func (f *Factory) CreateJobForWorkflowJob(ctx context.Context, wfJob *oapi.WorkflowJob) (*oapi.Job, error) {
	jobAgent, exists := f.store.JobAgents.Get(wfJob.Ref)
	if !exists {
		return nil, fmt.Errorf("job agent %s not found", wfJob.Ref)
	}

	mergedConfig, err := f.buildWorkflowJobConfig(wfJob, jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to build workflow job config: %w", err)
	}

	dispatchContext, err := f.buildWorkflowJobDispatchContext(wfJob, jobAgent, mergedConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build workflow job dispatch context: %w", err)
	}

	return &oapi.Job{
		Id:              uuid.New().String(),
		WorkflowJobId:   wfJob.Id,
		JobAgentId:      jobAgent.Id,
		JobAgentConfig:  mergedConfig,
		Status:          oapi.JobStatusPending,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		Metadata:        make(map[string]string),
		DispatchContext: dispatchContext,
	}, nil
}
