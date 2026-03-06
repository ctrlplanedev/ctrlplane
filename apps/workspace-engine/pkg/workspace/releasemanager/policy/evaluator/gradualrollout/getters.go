package gradualrollout

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
)

type approvalGetters = approval.Getters
type environmentProgressionGetters = environmentprogression.Getters

type Getters interface {
	approvalGetters
	environmentProgressionGetters

	GetPoliciesForTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error)
	GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip

	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) bool
	GetResource(resourceID string) (*oapi.Resource, bool)
	GetDeployment(deploymentID string) (*oapi.Deployment, bool)
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
}
