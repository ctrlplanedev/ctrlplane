package workflows

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

func stringInput(key string, def *string) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     key,
		Type:    "string",
		Default: def,
	})
	return input
}

func numberInput(key string, def *float32) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     key,
		Type:    "number",
		Default: def,
	})
	return input
}

func booleanInput(key string, def *bool) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     key,
		Type:    "boolean",
		Default: def,
	})
	return input
}

func ptr[T any](v T) *T { return &v }

func TestResolveInputs_ProvidedInputsPassThrough(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
		},
	}
	provided := map[string]any{"env": "production"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
}

func TestResolveInputs_MissingInputsGetDefaults(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
			numberInput("retries", ptr(float32(3))),
			booleanInput("dryRun", ptr(true)),
		},
	}
	provided := map[string]any{}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "staging", resolved["env"])
	assert.InDelta(t, float32(3), resolved["retries"], 0)
	assert.Equal(t, true, resolved["dryRun"])
}

func TestResolveInputs_InputsWithoutDefaultsStayAbsent(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", nil),
			numberInput("retries", nil),
			booleanInput("dryRun", nil),
		},
	}
	provided := map[string]any{}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.NotContains(t, resolved, "env")
	assert.NotContains(t, resolved, "retries")
	assert.NotContains(t, resolved, "dryRun")
}

func TestResolveInputs_ProvidedOverridesDefault(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
			numberInput("retries", ptr(float32(3))),
			booleanInput("dryRun", ptr(true)),
		},
	}
	provided := map[string]any{
		"env":     "production",
		"retries": 10,
		"dryRun":  false,
	}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.Equal(t, 10, resolved["retries"])
	assert.Equal(t, false, resolved["dryRun"])
}

func TestResolveInputs_MixedProvidedAndDefaults(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
			numberInput("retries", ptr(float32(3))),
			booleanInput("verbose", nil),
		},
	}
	provided := map[string]any{"env": "production"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.InDelta(t, float32(3), resolved["retries"], 0)
	assert.NotContains(t, resolved, "verbose")
}

func TestResolveInputs_DoesNotMutateProvidedMap(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
		},
	}
	provided := map[string]any{"existing": "value"}

	_, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Len(t, provided, 1)
	assert.Equal(t, "value", provided["existing"])
}

func TestResolveInputs_EmptyWorkflowInputs(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{},
	}
	provided := map[string]any{"extra": "value"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "value", resolved["extra"])
}

func TestResolveInputs_ExtraProvidedInputsPassThrough(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", ptr("staging")),
		},
	}
	provided := map[string]any{
		"env":   "production",
		"extra": "unexpected",
	}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.Equal(t, "unexpected", resolved["extra"])
}
