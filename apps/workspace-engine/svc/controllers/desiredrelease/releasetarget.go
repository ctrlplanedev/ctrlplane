package desiredrelease

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/db"

	"github.com/google/uuid"
)

func NewReleaseTarget(key string) (*ReleaseTarget, error) {
	split := strings.SplitN(key, ":", 3)
	if len(split) != 3 {
		return nil, fmt.Errorf("invalid release target key: %s", key)
	}

	deploymentID, err := uuid.Parse(split[0])
	if err != nil {
		return nil, fmt.Errorf("invalid deployment id: %s", split[0])
	}
	environmentID, err := uuid.Parse(split[1])
	if err != nil {
		return nil, fmt.Errorf("invalid environment id: %s", split[1])
	}
	resourceID, err := uuid.Parse(split[2])
	if err != nil {
		return nil, fmt.Errorf("invalid resource id: %s", split[2])
	}

	return &ReleaseTarget{
		DeploymentID:  deploymentID,
		EnvironmentID: environmentID,
		ResourceID:    resourceID,
	}, nil
}

type ReleaseTarget struct {
	DeploymentID  uuid.UUID `json:"deployment_id"`
	EnvironmentID uuid.UUID `json:"environment_id"`
	ResourceID    uuid.UUID `json:"resource_id"`
}

func (rt *ReleaseTarget) Deployment(ctx context.Context) (db.Deployment, error) {
	return db.GetQueries(ctx).GetDeploymentByID(ctx, rt.DeploymentID)
}

func (rt *ReleaseTarget) Environment(ctx context.Context) (db.Environment, error) {
	return db.GetQueries(ctx).GetEnvironmentByID(ctx, rt.EnvironmentID)
}

func (rt *ReleaseTarget) Resource(ctx context.Context) (db.Resource, error) {
	return db.Resource{}, fmt.Errorf("not implemented")
}
