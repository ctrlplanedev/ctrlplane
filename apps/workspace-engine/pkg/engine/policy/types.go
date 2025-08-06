package policy

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/engine/selector"

	"github.com/google/uuid"
)

type Policy struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Enabled     bool
	Priority    int
	Targets     []PolicyTarget
}

type PolicyTarget struct {
	ID                  uuid.UUID
	DeploymentSelector  *selector.Condition
	EnvironmentSelector *selector.Condition
	ResourceSelector    *selector.Condition
}

type PolicySelectorEngine interface {
	LoadPolicies(ctx context.Context, policies []Policy) error
	UpsertPolicy(ctx context.Context, policy Policy) error
	RemovePolicies(ctx context.Context, policies []Policy) error
	RemovePolicy(ctx context.Context, policy Policy) error

	LoadDeployments(ctx context.Context, deployments []selector.BaseEntity) error
	UpsertDeployment(ctx context.Context, deployment selector.BaseEntity) error
	RemoveDeployments(ctx context.Context, deployments []selector.BaseEntity) error
	RemoveDeployment(ctx context.Context, deployment selector.BaseEntity) error

	LoadEnvironments(ctx context.Context, environments []selector.BaseEntity) error
	UpsertEnvironment(ctx context.Context, environment selector.BaseEntity) error
	RemoveEnvironments(ctx context.Context, environments []selector.BaseEntity) error
	RemoveEnvironment(ctx context.Context, environment selector.BaseEntity) error

	LoadResources(ctx context.Context, resources []selector.BaseEntity) error
	UpsertResource(ctx context.Context, resource selector.BaseEntity) error
	RemoveResources(ctx context.Context, resources []selector.BaseEntity) error
	RemoveResource(ctx context.Context, resource selector.BaseEntity) error

	GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget engine.ReleaseTarget) ([]Policy, error)
}
