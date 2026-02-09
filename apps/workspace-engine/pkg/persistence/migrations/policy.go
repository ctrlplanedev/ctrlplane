package migrations

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/log"
)

// PolicySelectorsToSelector converts the old selectors[] array format to a
// single selector CEL string. The old format stored an array of
// PolicyTargetSelector objects, each with optional deploymentSelector,
// environmentSelector, and resourceSelector sub-objects containing a "cel"
// field. The new format is a single CEL expression string.
//
// Rules:
//   - If "selector" already exists, the data is already migrated — no-op.
//   - If "selectors" is nil or empty, set "selector" to "true" (match-all).
//   - For each selector entry, AND the non-nil sub-selector CEL expressions.
//   - OR across multiple selector entries.
//   - Delete the "selectors" key from the map.
func PolicySelectorsToSelector(entityType string, data map[string]any) (map[string]any, error) {
	if entityType != "policy" {
		return data, nil
	}

	if _, ok := data["selector"]; ok {
		return data, nil
	}

	policyID, _ := data["id"].(string)
	log.Info("Running policy selectors-to-selector migration", "policyId", policyID)

	selectorsRaw, ok := data["selectors"]
	if !ok || selectorsRaw == nil {
		data["selector"] = "true"
		delete(data, "selectors")
		return data, nil
	}

	selectors, ok := selectorsRaw.([]any)
	if !ok {
		return nil, fmt.Errorf("selectors field is not an array: %T", selectorsRaw)
	}

	if len(selectors) == 0 {
		data["selector"] = "true"
		delete(data, "selectors")
		return data, nil
	}

	var orClauses []string
	for i, entry := range selectors {
		entryMap, ok := entry.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("selectors[%d] is not an object: %T", i, entry)
		}

		andParts, err := extractSelectorCELParts(entryMap)
		if err != nil {
			return nil, fmt.Errorf("selectors[%d]: %w", i, err)
		}

		if len(andParts) == 0 {
			// No sub-selectors means this entry matches everything.
			orClauses = append(orClauses, "true")
			continue
		}

		if len(andParts) == 1 {
			orClauses = append(orClauses, andParts[0])
			continue
		}

		// Wrap each sub-selector in parens to preserve precedence when combined.
		wrapped := make([]string, len(andParts))
		for j, p := range andParts {
			wrapped[j] = "(" + p + ")"
		}
		clause := strings.Join(wrapped, " && ")
		orClauses = append(orClauses, clause)
	}

	var selector string
	switch len(orClauses) {
	case 0:
		selector = "true"
	case 1:
		selector = orClauses[0]
	default:
		// Wrap each clause in parens and OR them together.
		wrapped := make([]string, len(orClauses))
		for i, c := range orClauses {
			wrapped[i] = "(" + c + ")"
		}
		selector = strings.Join(wrapped, " || ")
	}

	data["selector"] = selector
	delete(data, "selectors")
	return data, nil
}

// extractSelectorCELParts extracts CEL expression strings from the
// deploymentSelector, environmentSelector, and resourceSelector sub-objects
// of a PolicyTargetSelector map.
func extractSelectorCELParts(entry map[string]any) ([]string, error) {
	keys := []string{"deploymentSelector", "environmentSelector", "resourceSelector"}
	var parts []string

	for _, key := range keys {
		raw, ok := entry[key]
		if !ok || raw == nil {
			continue
		}

		selectorMap, ok := raw.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s is not an object: %T", key, raw)
		}

		celVal, ok := selectorMap["cel"]
		if !ok || celVal == nil {
			continue
		}

		celStr, ok := celVal.(string)
		if !ok {
			return nil, fmt.Errorf("%s.cel is not a string: %T", key, celVal)
		}

		celStr = strings.TrimSpace(celStr)
		if celStr == "" || celStr == "true" {
			continue
		}

		parts = append(parts, celStr)
	}

	return parts, nil
}
