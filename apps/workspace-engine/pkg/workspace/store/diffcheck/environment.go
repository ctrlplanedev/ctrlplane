package diffcheck

import (
	"slices"

	"github.com/r3labs/diff/v3"
	"workspace-engine/pkg/oapi"
)

// HasEnvironmentChanges detects changes between two environments using structural diffing
// Returns a map where keys are field paths (e.g., "name", "description", "resourceSelector")
// and values are always true (indicating the field changed)
// Ignores system-managed fields like createdAt and id.
func HasEnvironmentChanges(old, updated *oapi.Environment) map[string]bool {
	if old == nil || updated == nil {
		return map[string]bool{"all": true}
	}

	changed := make(map[string]bool)

	// Use diff library to detect all changes
	changelog, err := diff.Diff(old, updated)
	if err != nil {
		// Fallback to basic comparison if diff fails
		return hasEnvironmentChangesBasic(old, updated)
	}

	// Convert diff changelog to our field path format
	for _, change := range changelog {
		fieldPath := convertPathToFieldName(change.Path)

		// Ignore system-managed fields
		if isIgnoredEnvironmentField(fieldPath) {
			continue
		}

		if fieldPath != "" {
			changed[fieldPath] = true
		}
	}

	return changed
}

// isIgnoredEnvironmentField checks if a field should be ignored when comparing environments.
func isIgnoredEnvironmentField(fieldPath string) bool {
	ignoredFields := []string{
		"createdat",
		"id",
	}

	return slices.Contains(ignoredFields, fieldPath)
}

// hasEnvironmentChangesBasic is a fallback implementation without external dependencies.
func hasEnvironmentChangesBasic(old, updated *oapi.Environment) map[string]bool {
	changed := make(map[string]bool)

	if old.Name != updated.Name {
		changed["name"] = true
	}

	// Compare Description (pointer field)
	if (old.Description == nil && updated.Description != nil) ||
		(old.Description != nil && updated.Description == nil) ||
		(old.Description != nil && updated.Description != nil && *old.Description != *updated.Description) {
		changed["description"] = true
	}

	// Compare ResourceSelector using deep equality
	if !deepEqual(old.ResourceSelector, updated.ResourceSelector) {
		changed["resourceselector"] = true
	}

	return changed
}
