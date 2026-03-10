package policyeval

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	pevalgetters "workspace-engine/svc/controllers/desiredrelease/policyeval"
)

type policyEvalGetter = pevalgetters.Getter

type Getter interface {
	policyEvalGetter

	GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error)
	GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error)
	GetPoliciesForReleaseTarget(ctx context.Context, rt *oapi.ReleaseTarget) ([]*oapi.Policy, error)
}
