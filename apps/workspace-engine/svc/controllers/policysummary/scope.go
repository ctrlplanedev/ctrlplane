package policysummary

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type EnvironmentScope struct {
	EnvironmentID uuid.UUID
}

func ParseEnvironmentScope(scopeID string) (*EnvironmentScope, error) {
	envID, err := uuid.Parse(scopeID)
	if err != nil {
		return nil, fmt.Errorf("parse environment scope: %w", err)
	}
	return &EnvironmentScope{EnvironmentID: envID}, nil
}

type EnvironmentVersionScope struct {
	EnvironmentID uuid.UUID
	VersionID     uuid.UUID
}

func ParseEnvironmentVersionScope(scopeID string) (*EnvironmentVersionScope, error) {
	parts := strings.SplitN(scopeID, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid environment-version scope: %s", scopeID)
	}
	envID, err := uuid.Parse(parts[0])
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	versionID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	return &EnvironmentVersionScope{EnvironmentID: envID, VersionID: versionID}, nil
}

type DeploymentVersionScope struct {
	DeploymentID uuid.UUID
	VersionID    uuid.UUID
}

func ParseDeploymentVersionScope(scopeID string) (*DeploymentVersionScope, error) {
	parts := strings.SplitN(scopeID, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid deployment-version scope: %s", scopeID)
	}
	depID, err := uuid.Parse(parts[0])
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	versionID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	return &DeploymentVersionScope{DeploymentID: depID, VersionID: versionID}, nil
}
