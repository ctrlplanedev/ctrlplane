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

// CreateJobForRelease creates a job for a given release (PURE FUNCTION, NO WRITES).
// The job is configured with merged settings from JobAgent + Deployment.
func (f *Factory) CreateJobForRelease(ctx context.Context, release *oapi.Release, action *trace.Action) (*oapi.Job, error) {
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

	// Check if job agent is configured
	jobAgentId := deployment.JobAgentId
	if jobAgentId == nil || *jobAgentId == "" {
		if action != nil {
			action.AddStep("Validate job agent", trace.StepResultFail,
				fmt.Sprintf("No job agent configured for deployment '%s'. Jobs cannot be created without a job agent.", deployment.Name)).
				AddMetadata("deployment_id", deployment.Id).
				AddMetadata("deployment_name", deployment.Name).
				AddMetadata("issue", "missing_job_agent_configuration")
		}
		// Create job with InvalidJobAgent status when no job agent configured
		return &oapi.Job{
			Id:             uuid.New().String(),
			ReleaseId:      release.ID(),
			JobAgentId:     "",
			JobAgentConfig: make(map[string]any),
			Status:         oapi.JobStatusInvalidJobAgent,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
			Metadata:       make(map[string]string),
		}, nil
	}

	// Validate job agent exists
	jobAgent, exists := f.store.JobAgents.Get(*jobAgentId)
	if !exists {
		if action != nil {
			action.AddStep("Validate job agent", trace.StepResultFail,
				fmt.Sprintf("Job agent '%s' configured on deployment '%s' does not exist or was deleted", *jobAgentId, deployment.Name)).
				AddMetadata("job_agent_id", *jobAgentId).
				AddMetadata("deployment_id", deployment.Id).
				AddMetadata("deployment_name", deployment.Name).
				AddMetadata("issue", "job_agent_not_found")
		}
		// Create job with InvalidJobAgent status when job agent not found
		return &oapi.Job{
			Id:             uuid.New().String(),
			ReleaseId:      release.ID(),
			JobAgentId:     *jobAgentId,
			JobAgentConfig: make(map[string]any),
			Status:         oapi.JobStatusInvalidJobAgent,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
			Metadata:       make(map[string]string),
		}, nil
	}

	if action != nil {
		action.AddStep("Validate job agent", trace.StepResultPass,
			fmt.Sprintf("Job agent '%s' (type: %s) found and validated", jobAgent.Name, jobAgent.Type)).
			AddMetadata("job_agent_id", jobAgent.Id).
			AddMetadata("job_agent_name", jobAgent.Name).
			AddMetadata("job_agent_type", jobAgent.Type)
	}

	// Merge job agent config: deployment config overrides agent defaults
	mergedConfig := make(map[string]any)
	hasAgentConfig := len(jobAgent.Config) > 0
	hasDeploymentConfig := len(deployment.JobAgentConfig) > 0

	deepMerge(mergedConfig, jobAgent.Config)
	deepMerge(mergedConfig, deployment.JobAgentConfig)

	if action != nil {
		configMsg := "Applied default job agent configuration"
		if hasAgentConfig && hasDeploymentConfig {
			configMsg = fmt.Sprintf("Merged job agent config (%d keys) with deployment overrides (%d keys)",
				len(jobAgent.Config), len(deployment.JobAgentConfig))
		} else if hasDeploymentConfig {
			configMsg = fmt.Sprintf("Applied deployment-specific job config (%d keys)", len(deployment.JobAgentConfig))
		}

		action.AddStep("Configure job", trace.StepResultPass, configMsg).
			AddMetadata("job_agent_config_keys", len(jobAgent.Config)).
			AddMetadata("deployment_config_keys", len(deployment.JobAgentConfig)).
			AddMetadata("merged_config_keys", len(mergedConfig)).
			AddMetadata("has_deployment_overrides", hasDeploymentConfig)
	}

	jobId := uuid.New().String()

	if action != nil {
		action.AddStep("Create job", trace.StepResultPass,
			fmt.Sprintf("Job created successfully with ID %s for release %s", jobId, release.ID())).
			AddMetadata("job_id", jobId).
			AddMetadata("job_status", string(oapi.JobStatusPending)).
			AddMetadata("job_agent_id", *jobAgentId).
			AddMetadata("release_id", release.ID()).
			AddMetadata("version_tag", release.Version.Tag)
	}

	return &oapi.Job{
		Id:             jobId,
		ReleaseId:      release.ID(),
		JobAgentId:     *jobAgentId,
		JobAgentConfig: mergedConfig,
		Status:         oapi.JobStatusPending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       make(map[string]string),
	}, nil
}

// deepMerge recursively merges src into dst.
func deepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				deepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v // overwrite
	}
}
