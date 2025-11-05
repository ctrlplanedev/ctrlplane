package diffcheck

import (
	"workspace-engine/pkg/oapi"

	"github.com/r3labs/diff/v3"
)

// HasDeploymentChanges detects changes between two deployments using structural diffing
// Returns a map where keys are field paths (e.g., "name", "slug", "jobAgentConfig.key")
// and values are always true (indicating the field changed)
// Supports deeply nested paths for complex jobAgentConfig structures
// Ignores system-managed fields like id
func HasDeploymentChanges(old, new *oapi.Deployment) map[string]bool {
	if old == nil || new == nil {
		return map[string]bool{"all": true}
	}

	changed := make(map[string]bool)

	// Use diff library to detect all changes
	changelog, err := diff.Diff(old, new)
	if err != nil {
		// Fallback to basic comparison if diff fails
		return hasDeploymentChangesBasic(old, new)
	}

	// Convert diff changelog to our field path format
	for _, change := range changelog {
		fieldPath := convertPathToFieldName(change.Path)
		
		// Ignore system-managed fields
		if isIgnoredDeploymentField(fieldPath) {
			continue
		}
		
		if fieldPath != "" {
			changed[fieldPath] = true
		}
	}

	return changed
}

// isIgnoredDeploymentField checks if a field should be ignored when comparing deployments
func isIgnoredDeploymentField(fieldPath string) bool {
	ignoredFields := []string{
		"id",
	}
	
	for _, ignored := range ignoredFields {
		if fieldPath == ignored {
			return true
		}
	}
	
	return false
}

// hasDeploymentChangesBasic is a fallback implementation without external dependencies
func hasDeploymentChangesBasic(old, new *oapi.Deployment) map[string]bool {
	changed := make(map[string]bool)

	if old.Name != new.Name {
		changed["name"] = true
	}
	if old.Slug != new.Slug {
		changed["slug"] = true
	}
	if old.SystemId != new.SystemId {
		changed["systemid"] = true
	}

	// Compare Description (pointer field)
	if (old.Description == nil && new.Description != nil) ||
		(old.Description != nil && new.Description == nil) ||
		(old.Description != nil && new.Description != nil && *old.Description != *new.Description) {
		changed["description"] = true
	}

	// Compare JobAgentId (pointer field)
	if (old.JobAgentId == nil && new.JobAgentId != nil) ||
		(old.JobAgentId != nil && new.JobAgentId == nil) ||
		(old.JobAgentId != nil && new.JobAgentId != nil && *old.JobAgentId != *new.JobAgentId) {
		changed["jobagentid"] = true
	}

	// Compare JobAgentConfig (map)
	for key := range old.JobAgentConfig {
		if newVal, exists := new.JobAgentConfig[key]; !exists || !deepEqual(old.JobAgentConfig[key], newVal) {
			changed["jobagentconfig."+key] = true
		}
	}
	for key := range new.JobAgentConfig {
		if _, exists := old.JobAgentConfig[key]; !exists {
			changed["jobagentconfig."+key] = true
		}
	}

	// Compare ResourceSelector using deep equality
	if !deepEqual(old.ResourceSelector, new.ResourceSelector) {
		changed["resourceselector"] = true
	}

	return changed
}