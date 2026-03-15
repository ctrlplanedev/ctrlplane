package deploymentplan

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

// ReleaseTarget identifies a single (environment, resource) pair.
type ReleaseTarget struct {
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
}

// Getter abstracts read operations needed by the plan controller.
type Getter interface {
	GetDeploymentPlan(ctx context.Context, id uuid.UUID) (db.DeploymentPlan, error)
	GetDeployment(ctx context.Context, id uuid.UUID) (*oapi.Deployment, error)
	GetReleaseTargets(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error)
	GetEnvironment(ctx context.Context, id uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, id uuid.UUID) (*oapi.Resource, error)
	GetJobAgent(ctx context.Context, id uuid.UUID) (*oapi.JobAgent, error)
}

// VarResolver resolves deployment variables for a release target.
type VarResolver interface {
	Resolve(ctx context.Context, scope *variableresolver.Scope, deploymentID, resourceID string) (map[string]oapi.LiteralValue, error)
}
