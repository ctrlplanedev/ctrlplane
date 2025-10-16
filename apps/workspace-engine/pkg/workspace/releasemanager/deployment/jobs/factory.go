// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
func (f *Factory) CreateJobForRelease(ctx context.Context, release *oapi.Release) (*oapi.Job, error) {
	_, span := tracer.Start(ctx, "CreateJobForRelease",
		trace.WithAttributes(
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

	// Validate job agent exists
	jobAgentId := deployment.JobAgentId
	if jobAgentId == nil || *jobAgentId == "" {
		return nil, fmt.Errorf("deployment %s has no job agent configured", deployment.Id)
	}

	jobAgent, exists := f.store.JobAgents.Get(*jobAgentId)
	if !exists {
		return nil, fmt.Errorf("job agent %s not found", *jobAgentId)
	}

	// Merge job agent config: deployment config overrides agent defaults
	mergedConfig := make(map[string]any)
	deepMerge(mergedConfig, jobAgent.Config)
	deepMerge(mergedConfig, deployment.JobAgentConfig)

	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.ID(),
		JobAgentId:     *jobAgentId,
		JobAgentConfig: mergedConfig,
		Status:         oapi.Pending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
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

