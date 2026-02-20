package configs

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/require"
)

func TestMerge_DeepMergePrecedenceAndNoInputMutation(t *testing.T) {
	agent := oapi.JobAgentConfig{
		"template": "agent-template",
		"shared": map[string]any{
			"timeout": 30,
			"nested": map[string]any{
				"keep": "agent-keep",
				"arr":  []any{"agent"},
			},
		},
		"list": []any{"agent"},
	}
	deployment := oapi.JobAgentConfig{
		"shared": map[string]any{
			"timeout": 45,
			"nested": map[string]any{
				"add": "deployment-add",
			},
		},
		"deploymentOnly": true,
	}
	version := oapi.JobAgentConfig{
		"template": "version-template",
		"shared": map[string]any{
			"nested": map[string]any{
				"keep": "version-override",
			},
		},
	}

	merged, err := Merge(agent, deployment, version)
	require.NoError(t, err)

	require.Equal(t, "version-template", merged["template"])
	require.Equal(t, true, merged["deploymentOnly"])

	shared, ok := merged["shared"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, 45, shared["timeout"])

	nested, ok := shared["nested"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "version-override", nested["keep"])
	require.Equal(t, "deployment-add", nested["add"])
}

func TestMerge_CreatesCopies_NotAliasesToInputs(t *testing.T) {
	agent := oapi.JobAgentConfig{
		"shared": map[string]any{
			"nested": map[string]any{
				"value": "agent",
			},
		},
		"list": []any{"a", map[string]any{"k": "v"}},
	}
	deployment := oapi.JobAgentConfig{
		"shared": map[string]any{
			"another": "deployment",
		},
	}

	merged, err := Merge(agent, deployment)
	require.NoError(t, err)

	agentNested := agent["shared"].(map[string]any)["nested"].(map[string]any)
	agentNested["value"] = "agent-mutated-after-merge"

	agentList := agent["list"].([]any)
	agentListMap := agentList[1].(map[string]any)
	agentListMap["k"] = "agent-list-mutated-after-merge"

	mergedShared := merged["shared"].(map[string]any)
	mergedNested := mergedShared["nested"].(map[string]any)
	require.Equal(t, "agent", mergedNested["value"])

	mergedList := merged["list"].([]any)
	mergedListMap := mergedList[1].(map[string]any)
	require.Equal(t, "v", mergedListMap["k"])

	mergedNested["value"] = "merged-mutated"
	require.Equal(t, "agent-mutated-after-merge", agentNested["value"])
}
