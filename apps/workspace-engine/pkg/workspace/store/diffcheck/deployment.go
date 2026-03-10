package diffcheck

import (
	"encoding/json"
	"slices"

	"github.com/r3labs/diff/v3"
	"workspace-engine/pkg/oapi"
)

// HasDeploymentChanges detects changes between two deployments using structural diffing
// Returns a map where keys are field paths (e.g., "name", "slug", "jobAgentConfig.key")
// and values are always true (indicating the field changed)
// Supports deeply nested paths for complex jobAgentConfig structures
// Ignores system-managed fields like id.
func HasDeploymentChanges(old, updated *oapi.Deployment) map[string]bool {
	if old == nil || updated == nil {
		return map[string]bool{"all": true}
	}

	changed := make(map[string]bool)

	// Normalize deployments to JSON maps before diffing so union types (e.g. jobAgentConfig)
	// are compared by their JSON object shape rather than internal union representation.
	toMap := func(d *oapi.Deployment) (map[string]any, error) {
		b, err := json.Marshal(d)
		if err != nil {
			return nil, err
		}
		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			return nil, err
		}
		if m == nil {
			m = map[string]any{}
		}
		return m, nil
	}

	oldMap, err := toMap(old)
	if err != nil {
		return hasDeploymentChangesBasic(old, updated)
	}
	newMap, err := toMap(updated)
	if err != nil {
		return hasDeploymentChangesBasic(old, updated)
	}

	// Use diff library to detect all changes
	changelog, err := diff.Diff(oldMap, newMap)
	if err != nil {
		// Fallback to basic comparison if diff fails
		return hasDeploymentChangesBasic(old, updated)
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

// isIgnoredDeploymentField checks if a field should be ignored when comparing deployments.
func isIgnoredDeploymentField(fieldPath string) bool {
	ignoredFields := []string{
		"id",
	}

	return slices.Contains(ignoredFields, fieldPath)
}

// hasDeploymentChangesBasic is a fallback implementation without external dependencies.
func hasDeploymentChangesBasic(old, updated *oapi.Deployment) map[string]bool {
	changed := make(map[string]bool)

	if old.Name != updated.Name {
		changed["name"] = true
	}
	if old.Slug != updated.Slug {
		changed["slug"] = true
	}

	// Compare Description (pointer field)
	if (old.Description == nil && updated.Description != nil) ||
		(old.Description != nil && updated.Description == nil) ||
		(old.Description != nil && updated.Description != nil && *old.Description != *updated.Description) {
		changed["description"] = true
	}

	// Compare JobAgentId (pointer field)
	if (old.JobAgentId == nil && updated.JobAgentId != nil) ||
		(old.JobAgentId != nil && updated.JobAgentId == nil) ||
		(old.JobAgentId != nil && updated.JobAgentId != nil && *old.JobAgentId != *updated.JobAgentId) {
		changed["jobagentid"] = true
	}

	oldJobAgentConfigJSON, err := json.Marshal(old.JobAgentConfig)
	if err != nil {
		return changed
	}
	updatedJobAgentConfigJSON, err := json.Marshal(updated.JobAgentConfig)
	if err != nil {
		return changed
	}

	var oldJobAgentConfigMap map[string]any
	err = json.Unmarshal(oldJobAgentConfigJSON, &oldJobAgentConfigMap)
	if err != nil {
		return changed
	}
	var updatedJobAgentConfigMap map[string]any
	err = json.Unmarshal(updatedJobAgentConfigJSON, &updatedJobAgentConfigMap)
	if err != nil {
		return changed
	}

	// Compare JobAgentConfig (map)
	for key := range oldJobAgentConfigMap {
		if newVal, exists := updatedJobAgentConfigMap[key]; !exists ||
			!deepEqual(oldJobAgentConfigMap[key], newVal) {
			changed["jobagentconfig."+key] = true
		}
	}
	for key := range updatedJobAgentConfigMap {
		if _, exists := oldJobAgentConfigMap[key]; !exists {
			changed["jobagentconfig."+key] = true
		}
	}

	// Compare ResourceSelector using deep equality
	if !deepEqual(old.ResourceSelector, updated.ResourceSelector) {
		changed["resourceselector"] = true
	}

	return changed
}
