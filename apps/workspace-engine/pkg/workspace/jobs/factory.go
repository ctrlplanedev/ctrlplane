// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

var tracer = otel.Tracer("workspace/releasemanager/jobs")

type Getters interface {
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error)
}

// Factory creates jobs for releases. When secretResolver is non-nil and
// the dispatching job agent has job_agent-scoped variables, those are
// resolved at BuildDispatchContext time and surfaced under
// DispatchContext.JobAgentVariables for template interpolation.
type Factory struct {
	getters        Getters
	secretResolver variableresolver.SecretResolver
}

func NewFactoryFromGetters(getters Getters) *Factory {
	return &Factory{getters: getters}
}

// NewFactoryWithSecrets constructs a Factory that resolves job-agent scoped
// secret_ref variables for every dispatch. Callers without a secret
// resolver should use NewFactoryFromGetters.
func NewFactoryWithSecrets(
	getters Getters,
	secretResolver variableresolver.SecretResolver,
) *Factory {
	return &Factory{getters: getters, secretResolver: secretResolver}
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
		if err := f.populateJobAgentVariables(ctx, dc, jobAgent); err != nil {
			return nil, err
		}
		// Template-render any `{{ ... }}` strings in the agent config
		// against the dispatch context, so agent configs can reference
		// resolved jobAgentVariables (e.g. apiKey: "{{ .jobAgentVariables.argo_token }}").
		rendered, err := renderJobAgentConfig(dc.JobAgentConfig, dc)
		if err != nil {
			return nil, fmt.Errorf("render job agent config: %w", err)
		}
		dc.JobAgentConfig = rendered
	}

	return dc, nil
}

// populateJobAgentVariables resolves variables scoped to the dispatching
// job agent and writes them onto the DispatchContext. A nil secretResolver
// (NewFactoryFromGetters caller) short-circuits to a no-op; only callers
// that wired NewFactoryWithSecrets pay for the lookup.
func (f *Factory) populateJobAgentVariables(
	ctx context.Context,
	dc *oapi.DispatchContext,
	jobAgent *oapi.JobAgent,
) error {
	if f.secretResolver == nil {
		return nil
	}
	jobAgentID, err := uuid.Parse(jobAgent.Id)
	if err != nil {
		return fmt.Errorf("parse job agent id: %w", err)
	}
	workspaceID, err := uuid.Parse(jobAgent.WorkspaceId)
	if err != nil {
		return fmt.Errorf("parse job agent workspace id: %w", err)
	}

	getter := variableresolver.NewPostgresGetter(db.GetQueries(ctx))
	resolved, sensitiveKeys, err := variableresolver.ResolveForJobAgent(
		ctx,
		getter,
		f.secretResolver,
		workspaceID,
		jobAgentID,
	)
	if err != nil {
		return fmt.Errorf("resolve job agent variables for %s: %w", jobAgentID, err)
	}
	if len(resolved) == 0 {
		return nil
	}
	dc.JobAgentVariables = &resolved
	if len(sensitiveKeys) > 0 {
		slog.InfoContext(ctx, "job agent variables resolved",
			"job_agent_id", jobAgentID.String(),
			"resolved_count", len(resolved),
			"sensitive_count", len(sensitiveKeys),
		)
	}
	return nil
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
