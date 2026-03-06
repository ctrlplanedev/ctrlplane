package policysummary

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type Getter interface {
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error)

	GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error)
	GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error)

	// TODO: These may need to be added or adapted from existing store methods.
	// The summary evaluators use getters internally; these are for building the
	// EvaluatorScope that gets passed to the evaluators.
}
