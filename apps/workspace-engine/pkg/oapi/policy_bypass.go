package oapi

import (
	"fmt"
	"time"
)

// CompactionKey implements the persistence.Entity interface for PolicyBypass
func (pb *PolicyBypass) CompactionKey() (string, string) {
	return "PolicyBypass", pb.Id
}

// Key generates a lookup key for the bypass based on version, environment, and resource
// This is used for efficient lookups in the in-memory store
func (pb *PolicyBypass) Key() string {
	// Build key based on specificity: version + environment + resource
	if pb.ResourceId != nil {
		if pb.EnvironmentId != nil {
			// Most specific: version + environment + resource
			return fmt.Sprintf("%s-%s-%s", pb.VersionId, *pb.EnvironmentId, *pb.ResourceId)
		}
		// version + resource (no environment) - shouldn't typically happen but handle it
		return fmt.Sprintf("%s-*-%s", pb.VersionId, *pb.ResourceId)
	}

	if pb.EnvironmentId != nil {
		// version + environment (all resources)
		return fmt.Sprintf("%s-%s-*", pb.VersionId, *pb.EnvironmentId)
	}

	// version only (all environments and resources)
	return fmt.Sprintf("%s-*-*", pb.VersionId)
}

// IsExpired checks if the bypass has expired
func (pb *PolicyBypass) IsExpired() bool {
	if pb.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*pb.ExpiresAt)
}
