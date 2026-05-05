package desiredrelease

import (
	"context"
	"iter"

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

	// IterCandidateVersions yields deployable versions newest-first. The
	// caller is expected to stop iterating once a deployable version is
	// found, so the implementation must lazily page through history rather
	// than buffering all versions up front.
	//
	// extraWhere is an optional list of SQL fragments that get AND-joined
	// into the candidate query as a pushdown filter. Each fragment is
	// expected to reference columns via the alias `version` (e.g.
	// `version.tag = 'v1.2.3'`). Fragments must be safely escaped before
	// reaching this method — they are concatenated into the SQL string
	// directly. When the iterator can't push down (no fragments supplied,
	// or the consumer doesn't extract any), it behaves identically to the
	// non-pushdown path.
	IterCandidateVersions(
		ctx context.Context,
		deploymentID uuid.UUID,
		extraWhere []string,
	) iter.Seq2[*oapi.DeploymentVersion, error]

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
