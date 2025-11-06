package diffcheck

import (
	"strings"
	"workspace-engine/pkg/oapi"

	"github.com/r3labs/diff/v3"
)

// HasResourceChanges detects changes between two resources using structural diffing
// Returns a map where keys are field paths (e.g., "name", "config.replicas", "config.database.host", "metadata.env")
// and values are always true (indicating the field changed)
// Supports deeply nested paths for complex config/metadata structures
func HasResourceChanges(old, new *oapi.Resource) map[string]bool {
	if old == nil || new == nil {
		return map[string]bool{"all": true}
	}

	changed := make(map[string]bool)

	// Use diff library to detect all changes
	changelog, err := diff.Diff(old, new)
	if err != nil {
		// Fallback to basic comparison if diff fails
		return hasResourceChangesBasic(old, new)
	}

	// Convert diff changelog to our field path format
	for _, change := range changelog {
		// change.Path is like ["Name"], ["Config", "replicas"], ["Metadata", "env"]
		fieldPath := convertPathToFieldName(change.Path)

		// Ignore system-managed fields that don't indicate meaningful resource changes
		if isIgnoredField(fieldPath) {
			continue
		}

		if fieldPath != "" {
			changed[fieldPath] = true
		}
	}

	return changed
}

// isIgnoredField checks if a field should be ignored when comparing resources
func isIgnoredField(fieldPath string) bool {
	// Ignore timestamp and system-managed fields
	ignoredFields := []string{
		"createdat",
		"updatedat",
		"lockedat",
		"deletedat",
		"id",
		"workspaceid",
		"providerid",
	}

	for _, ignored := range ignoredFields {
		if fieldPath == ignored {
			return true
		}
	}

	return false
}

// convertPathToFieldName converts a diff path to our field naming convention
// Supports deeply nested paths by concatenating all path elements with dots
// Examples:
//   - ["Name"] -> "name"
//   - ["Config", "replicas"] -> "config.replicas"
//   - ["Config", "database", "host"] -> "config.database.host"
//   - ["Config", "volumes", "1", "mountPath"] -> "config.volumes.1.mountPath"
//   - ["Metadata", "env"] -> "metadata.env"
func convertPathToFieldName(path []string) string {
	if len(path) == 0 {
		return ""
	}

	// Convert first element to lowercase
	result := strings.ToLower(path[0])

	// Append remaining path elements with dots
	for i := 1; i < len(path); i++ {
		result += "." + path[i]
	}

	return result
}

// hasResourceChangesBasic is a fallback implementation without external dependencies
func hasResourceChangesBasic(old, new *oapi.Resource) map[string]bool {
	changed := make(map[string]bool)

	if old.Name != new.Name {
		changed["name"] = true
	}
	if old.Kind != new.Kind {
		changed["kind"] = true
	}
	if old.Identifier != new.Identifier {
		changed["identifier"] = true
	}
	if old.Version != new.Version {
		changed["version"] = true
	}

	// Compare config
	for key := range old.Config {
		if newVal, exists := new.Config[key]; !exists || !deepEqual(old.Config[key], newVal) {
			changed["config."+key] = true
		}
	}
	for key := range new.Config {
		if _, exists := old.Config[key]; !exists {
			changed["config."+key] = true
		}
	}

	// Compare metadata
	for key := range old.Metadata {
		if newVal, exists := new.Metadata[key]; !exists || old.Metadata[key] != newVal {
			changed["metadata."+key] = true
		}
	}
	for key := range new.Metadata {
		if _, exists := old.Metadata[key]; !exists {
			changed["metadata."+key] = true
		}
	}

	return changed
}

// deepEqual performs basic deep equality comparison
func deepEqual(a, b any) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Fast path for comparable types
	switch v := a.(type) {
	case string:
		if bStr, ok := b.(string); ok {
			return v == bStr
		}
	case int, int64, float64, bool:
		return a == b
	}

	// Use diff library for complex types
	changelog, err := diff.Diff(a, b)
	return err == nil && len(changelog) == 0
}
