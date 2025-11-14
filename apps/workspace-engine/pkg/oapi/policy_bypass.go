package oapi

import (
	"fmt"
	"slices"
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

// MatchesPolicy checks if the bypass applies to the given policy
// Returns true if PolicyIds is nil/empty (applies to all) or contains the policyId
func (pb *PolicyBypass) MatchesPolicy(policyId string) bool {
	if pb.PolicyIds == nil || len(*pb.PolicyIds) == 0 {
		return true
	}

	return slices.Contains(*pb.PolicyIds, policyId)
}

// BypassesRuleType checks if the bypass includes the given rule type
func (pb *PolicyBypass) BypassesRuleType(ruleType string) bool {
	for _, rt := range pb.BypassRuleTypes {
		if string(rt) == ruleType {
			return true
		}
	}
	return false
}
