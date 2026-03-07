package policysummary

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/policysummary/summaryeval"

	"github.com/google/uuid"
)

type evalGetter = summaryeval.Getter

type Getter interface {
	evalGetter

	GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error)
	GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error)
	GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error)
}
