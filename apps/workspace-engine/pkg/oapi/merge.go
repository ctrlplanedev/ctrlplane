package oapi

// DeepMergeConfigs returns a new JobAgentConfig that is the result of deep
// merging all provided configs left-to-right. Later configs take precedence.
// When both sides have a map[string]interface{} for the same key, the maps
// are merged recursively; all other value types are replaced outright.
func DeepMergeConfigs(configs ...JobAgentConfig) JobAgentConfig {
	out := make(JobAgentConfig, len(configs))
	for _, cfg := range configs {
		deepMergeInto(out, cfg)
	}
	return out
}

func deepMergeInto(dst, src map[string]interface{}) {
	for k, srcVal := range src {
		dstVal, exists := dst[k]
		if !exists {
			dst[k] = srcVal
			continue
		}

		dstMap, dstOK := dstVal.(map[string]interface{})
		srcMap, srcOK := srcVal.(map[string]interface{})
		if dstOK && srcOK {
			deepMergeInto(dstMap, srcMap)
			continue
		}

		dst[k] = srcVal
	}
}
