package oapi

import (
	"fmt"
	"time"
)

// CompactionKey implements the persistence.Entity interface for PolicyBypass
func (ps *PolicySkip) CompactionKey() (string, string) {
	return "PolicySkip", ps.Id
}

// Key generates a lookup key for the skip based on version, environment, and resource
// This is used for efficient lookups in the in-memory store
func (ps *PolicySkip) Key() string {
	// Build key based on specificity: version + environment + resource
	if ps.ResourceId != nil {
		if ps.EnvironmentId != nil {
			// Most specific: version + environment + resource
			return fmt.Sprintf("%s-%s-%s", ps.VersionId, *ps.EnvironmentId, *ps.ResourceId)
		}
		// version + resource (no environment) - shouldn't typically happen but handle it
		return fmt.Sprintf("%s-*-%s", ps.VersionId, *ps.ResourceId)
	}

	if ps.EnvironmentId != nil {
		// version + environment (all resources)
		return fmt.Sprintf("%s-%s-*", ps.VersionId, *ps.EnvironmentId)
	}

	// version only (all environments and resources)
	return fmt.Sprintf("%s-*-*", ps.VersionId)
}

// IsExpired checks if the skip has expired
func (ps *PolicySkip) IsExpired() bool {
	if ps.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*ps.ExpiresAt)
}
