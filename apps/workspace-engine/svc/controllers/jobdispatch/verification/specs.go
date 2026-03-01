package verification

import (
	"encoding/json"

	"workspace-engine/pkg/oapi"
)

// GatherSpecs merges already-fetched policy verification specs with specs
// parsed from the job agent config, deduplicating by metric name. Policy
// specs take precedence over agent config specs.
func GatherSpecs(
	policySpecs []oapi.VerificationMetricSpec,
	agentConfig oapi.JobAgentConfig,
) []oapi.VerificationMetricSpec {
	agentSpecs := ParseAgentConfig(agentConfig)
	return MergeAndDeduplicate(policySpecs, agentSpecs)
}

// ParseAgentConfig extracts verification metric specs from the
// "verifications" key in a job agent config JSON object.
func ParseAgentConfig(config oapi.JobAgentConfig) []oapi.VerificationMetricSpec {
	if config == nil {
		return nil
	}

	raw, ok := config["verifications"]
	if !ok {
		return nil
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil
	}

	var specs []oapi.VerificationMetricSpec
	if err := json.Unmarshal(data, &specs); err != nil {
		return nil
	}

	return specs
}

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
