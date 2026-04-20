package variableresolver

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
)

// Getter provides the data needed to resolve deployment variables for a
// release target. Implementations backed by Postgres or in-memory mocks
// both satisfy this interface.
type Getter interface {
	GetDeploymentVariables(
		ctx context.Context,
		deploymentID string,
	) ([]oapi.DeploymentVariableWithValues, error)
	GetResourceVariables(
		ctx context.Context,
		resourceID string,
	) (map[string][]oapi.ResourceVariable, error)
	GetVariableSetsWithVariables(
		ctx context.Context,
		workspaceID uuid.UUID,
	) ([]oapi.VariableSetWithVariables, error)
	GetRelationshipRules(ctx context.Context, workspaceID uuid.UUID) ([]eval.Rule, error)
	LoadCandidates(
		ctx context.Context,
		workspaceID uuid.UUID,
		entityType string,
	) ([]eval.EntityData, error)
	GetEntityByID(
		ctx context.Context,
		entityID uuid.UUID,
		entityType string,
	) (*eval.EntityData, error)
}
