package jobdispatch

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type ReleaseTarget struct {
	DeploymentID  uuid.UUID
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
}

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
