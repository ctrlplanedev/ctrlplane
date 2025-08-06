package policy

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/engine/selector"

	"github.com/google/uuid"
)

type PolicyTarget struct {
	ID                  uuid.UUID
	DeploymentSelector  *selector.Condition
	EnvironmentSelector *selector.Condition
	ResourceSelector    *selector.Condition
}

type PolicyTargetSelectorEngine interface {
	LoadPoliciesTargets(ctx context.Context, policies []PolicyTarget) error
	UpsertPolicyTarget(ctx context.Context, policyTarget PolicyTarget) error
	RemovePoliciesTargets(ctx context.Context, policies []PolicyTarget) error
	RemovePolicyTarget(ctx context.Context, policyTarget PolicyTarget) error

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

	GetPolicyTargetsForReleaseTarget(ctx context.Context, releaseTarget engine.ReleaseTarget) ([]PolicyTarget, error)
}
