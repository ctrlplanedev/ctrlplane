package desiredrelease

import (
	"fmt"
	"strings"

	"workspace-engine/pkg/oapi"

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

func (rt *ReleaseTarget) FromOapi(o *oapi.ReleaseTarget) error {
	var err error
	rt.DeploymentID, err = uuid.Parse(o.DeploymentId)
	if err != nil {
		return fmt.Errorf("invalid deployment id: %w", err)
	}
	rt.EnvironmentID, err = uuid.Parse(o.EnvironmentId)
	if err != nil {
		return fmt.Errorf("invalid environment id: %w", err)
	}
	rt.ResourceID, err = uuid.Parse(o.ResourceId)
	if err != nil {
		return fmt.Errorf("invalid resource id: %w", err)
	}
	return nil
}
