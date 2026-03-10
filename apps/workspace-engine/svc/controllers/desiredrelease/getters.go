package desiredrelease

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

type postgresGetter = variableresolver.Getter
type policyevalGetter = policyeval.Getter

type Getter interface {
	postgresGetter
	policyevalGetter

	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)

	// ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error)
	GetCandidateVersions(
		ctx context.Context,
		deploymentID uuid.UUID,
	) ([]*oapi.DeploymentVersion, error)

	// GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error)
	// HasCurrentRelease(ctx context.Context, rt *ReleaseTarget) (bool, error)
	// GetCurrentRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
	// GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error)

	// // Variable resolution
	// GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error)
	// GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error)

	// // Realtime relationship resolution
	// GetRelationshipRules(ctx context.Context, workspaceID uuid.UUID) ([]eval.Rule, error)
	// LoadCandidates(ctx context.Context, workspaceID uuid.UUID, entityType string) ([]eval.EntityData, error)
	// GetEntityByID(ctx context.Context, entityID uuid.UUID, entityType string) (*eval.EntityData, error)
}
