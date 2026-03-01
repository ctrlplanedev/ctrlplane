package verification

import (
	"workspace-engine/pkg/oapi"
)

// MergeAndDeduplicate combines two slices of specs and removes duplicates
// by metric name. The first occurrence of each name wins, so policySpecs
// take precedence over agentSpecs.
func MergeAndDeduplicate(policySpecs, agentSpecs []oapi.VerificationMetricSpec) []oapi.VerificationMetricSpec {
	if len(policySpecs) == 0 && len(agentSpecs) == 0 {
		return nil
	}

	seen := make(map[string]bool, len(policySpecs)+len(agentSpecs))
	result := make([]oapi.VerificationMetricSpec, 0, len(policySpecs)+len(agentSpecs))

	for _, s := range policySpecs {
		if !seen[s.Name] {
			seen[s.Name] = true
			result = append(result, s)
		}
	}
	for _, s := range agentSpecs {
		if !seen[s.Name] {
			seen[s.Name] = true
			result = append(result, s)
		}
	}

	return result
}
