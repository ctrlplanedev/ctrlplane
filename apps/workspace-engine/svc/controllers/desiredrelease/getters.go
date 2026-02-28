package desiredrelease

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
)

type Getter interface {
	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error)
	GetCandidateVersions(ctx context.Context, deploymentID uuid.UUID) ([]*oapi.DeploymentVersion, error)
	GetPolicies(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Policy, error)

	GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error)
	HasCurrentRelease(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetCurrentRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
	GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error)

	// Variable resolution
	GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error)
	GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error)
	GetRelatedEntity(ctx context.Context, resourceID, reference string) ([]*oapi.EntityRelation, error)
}
