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
	// pushdownClauses is an optional list of SQL WHERE fragments that get
	// AND-joined into the candidate query. Each fragment is expected to
	// reference unqualified deployment_version columns and contain `$N`
	// placeholders that index into pushdownArgs starting at $5 (positions
	// $1-$4 are reserved for deploymentID, limit, and the keyset cursor).
	// Fragments come from celutil.SQLExtractor — they parameterize all
	// values, so SQL injection is structurally prevented rather than
	// relying on escaping. With no fragments supplied, the iterator
	// behaves identically to the non-pushdown path.
	IterCandidateVersions(
		ctx context.Context,
		deploymentID uuid.UUID,
		pushdownClauses []string,
		pushdownArgs []any,
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
