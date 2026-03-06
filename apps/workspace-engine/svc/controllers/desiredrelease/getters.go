package desiredrelease

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"

	"github.com/google/uuid"
)

type Getter interface {
	policyeval.Getter
	variableresolver.Getter

	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error)
	GetCandidateVersions(ctx context.Context, deploymentID uuid.UUID) ([]*oapi.DeploymentVersion, error)
	
	GetPoliciesForReleaseTarget(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Policy, error)

	GetCurrentRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
}
