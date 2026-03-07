package policysummary

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type Scope struct {
	EnvironmentID uuid.UUID
	VersionID     uuid.UUID
}

func ParseScope(scopeID string) (*Scope, error) {
	parts := strings.SplitN(scopeID, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid policy summary scope: %s", scopeID)
	}
	envID, err := uuid.Parse(parts[0])
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	versionID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	return &Scope{EnvironmentID: envID, VersionID: versionID}, nil
}
