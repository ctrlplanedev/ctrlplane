// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"encoding/json"
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

func (f *Factory) mergeJobAgentConfig(deployment *oapi.Deployment, jobAgent *oapi.JobAgent) (oapi.FullJobAgentConfig, error) {
	runnerDiscriminator, err := jobAgent.Config.Discriminator()
	if err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to get job agent config discriminator: %w", err)
	}

	var deploymentConfig interface{}
	switch runnerDiscriminator {
	case string(oapi.TestRunner):
	default:
		deploymentDiscriminator, err := deployment.JobAgentConfig.Discriminator()
		if err != nil {
			return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to get deployment job agent config discriminator: %w", err)
		}

		if deploymentDiscriminator != runnerDiscriminator {
			return oapi.FullJobAgentConfig{}, fmt.Errorf("deployment job agent config type %s does not match job agent config type %s", deploymentDiscriminator, runnerDiscriminator)
		}

		deploymentConfig, err = deployment.JobAgentConfig.ValueByDiscriminator()
		if err != nil {
			return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to get deployment job agent config: %w", err)
		}
	}

	runnerConfig, err := jobAgent.Config.ValueByDiscriminator()
	if err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to get job agent config: %w", err)
	}

	// ValueByDiscriminator returns a concrete struct type (as interface{}). Convert both to maps so we can deep-merge.
	toMap := func(v any) (map[string]any, error) {
		if v == nil {
			return map[string]any{}, nil
		}
		if m, ok := v.(map[string]any); ok {
			return m, nil
		}
		if m, ok := v.(map[string]interface{}); ok {
			out := make(map[string]any, len(m))
			for k, vv := range m {
				out[k] = vv
			}
			return out, nil
		}
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		var out map[string]any
		if err := json.Unmarshal(b, &out); err != nil {
			return nil, err
		}
		if out == nil {
			out = map[string]any{}
		}
		return out, nil
	}

	deploymentMap, err := toMap(deploymentConfig)
	if err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to convert deployment job agent config to map: %w", err)
	}
	runnerMap, err := toMap(runnerConfig)
	if err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to convert job agent config to map: %w", err)
	}

	// Merge job agent defaults first, then apply deployment overrides.
	mergedConfig := make(map[string]any)
	deepMerge(mergedConfig, runnerMap)
	deepMerge(mergedConfig, deploymentMap)

	// Ensure discriminator exists so the union can unmarshal.
	mergedConfig["type"] = runnerDiscriminator

	mergedJSON, err := json.Marshal(mergedConfig)
	if err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to marshal merged job agent config: %w", err)
	}

	var out oapi.FullJobAgentConfig
	if err := out.UnmarshalJSON(mergedJSON); err != nil {
		return oapi.FullJobAgentConfig{}, fmt.Errorf("failed to unmarshal merged job agent config: %w", err)
	}

	return out, nil
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
			JobAgentConfig: oapi.FullJobAgentConfig{},
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
			JobAgentConfig: oapi.FullJobAgentConfig{},
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
	mergedConfig, err := f.mergeJobAgentConfig(deployment, jobAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to merge job agent config: %v", err)
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
