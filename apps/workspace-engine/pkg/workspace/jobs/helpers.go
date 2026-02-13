package jobs

import "workspace-engine/pkg/oapi"

// mergeJobAgentConfig merges the given job agent configs into a single config.
// The configs are merged in the order they are provided, with later configs overriding earlier ones.
func mergeJobAgentConfig(configs ...oapi.JobAgentConfig) (oapi.JobAgentConfig, error) {
	mergedConfig := make(map[string]any)
	for _, config := range configs {
		deepMerge(mergedConfig, config)
	}
	return mergedConfig, nil
}

func deepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				deepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v
	}
}
