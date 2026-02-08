package migrations_test

import (
	"encoding/json"
	"testing"

	"workspace-engine/pkg/persistence/migrations"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func toMap(t *testing.T, jsonStr string) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(jsonStr), &m))
	return m
}

func TestPolicySelectorsToSelector_AlreadyMigrated(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selector": "deployment.name == 'web'",
		"selectors": [{"id": "s1"}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)

	// selector should be unchanged, selectors still present (no-op)
	assert.Equal(t, "deployment.name == 'web'", result["selector"])
	assert.NotNil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_NilSelectors(t *testing.T) {
	data := map[string]any{
		"id":        "p1",
		"selectors": nil,
	}

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_MissingSelectors(t *testing.T) {
	data := map[string]any{
		"id": "p1",
	}

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
}

func TestPolicySelectorsToSelector_EmptySelectorsArray(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": []
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_SingleSelector_AllDimensions(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"cel": "deployment.name == 'web'"},
			"environmentSelector": {"cel": "environment.name == 'prod'"},
			"resourceSelector": {"cel": "resource.kind == 'kubernetes'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t,
		"deployment.name == 'web' && environment.name == 'prod' && resource.kind == 'kubernetes'",
		result["selector"],
	)
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_SingleSelector_OnlyDeployment(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"cel": "deployment.name == 'api'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "deployment.name == 'api'", result["selector"])
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_SingleSelector_OnlyEnvironment(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"environmentSelector": {"cel": "environment.name == 'staging'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "environment.name == 'staging'", result["selector"])
}

func TestPolicySelectorsToSelector_SingleSelector_OnlyResource(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"resourceSelector": {"cel": "resource.kind == 'vm'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "resource.kind == 'vm'", result["selector"])
}

func TestPolicySelectorsToSelector_SingleSelector_NoSubSelectors(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{"id": "s1"}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
}

func TestPolicySelectorsToSelector_SingleSelector_NullSubSelectors(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": null,
			"environmentSelector": null,
			"resourceSelector": null
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
}

func TestPolicySelectorsToSelector_MultipleSelectors_ORed(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [
			{
				"id": "s1",
				"deploymentSelector": {"cel": "deployment.name == 'web'"},
				"environmentSelector": {"cel": "environment.name == 'prod'"}
			},
			{
				"id": "s2",
				"resourceSelector": {"cel": "resource.kind == 'kubernetes'"}
			}
		]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t,
		"(deployment.name == 'web' && environment.name == 'prod') || (resource.kind == 'kubernetes')",
		result["selector"],
	)
}

func TestPolicySelectorsToSelector_MultipleSelectors_ThreeEntries(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [
			{
				"id": "s1",
				"deploymentSelector": {"cel": "deployment.name == 'a'"}
			},
			{
				"id": "s2",
				"deploymentSelector": {"cel": "deployment.name == 'b'"}
			},
			{
				"id": "s3",
				"deploymentSelector": {"cel": "deployment.name == 'c'"}
			}
		]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t,
		"(deployment.name == 'a') || (deployment.name == 'b') || (deployment.name == 'c')",
		result["selector"],
	)
}

func TestPolicySelectorsToSelector_OtherFieldsPreserved(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"name": "my-policy",
		"priority": 10,
		"rules": [{"id": "r1"}],
		"selectors": []
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "true", result["selector"])
	assert.Equal(t, "p1", result["id"])
	assert.Equal(t, "my-policy", result["name"])
	assert.Equal(t, float64(10), result["priority"])
	assert.NotNil(t, result["rules"])
}

func TestPolicySelectorsToSelector_EmptyCelString(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"cel": ""},
			"environmentSelector": {"cel": "environment.name == 'prod'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	// Empty CEL string should be skipped
	assert.Equal(t, "environment.name == 'prod'", result["selector"])
}

func TestPolicySelectorsToSelector_WhitespaceCelString(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"cel": "   "},
			"resourceSelector": {"cel": "resource.kind == 'vm'"}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	assert.Equal(t, "resource.kind == 'vm'", result["selector"])
}

func TestPolicySelectorsToSelector_InvalidSelectorsType(t *testing.T) {
	data := map[string]any{
		"id":        "p1",
		"selectors": "not-an-array",
	}

	_, err := migrations.PolicySelectorsToSelector("policy", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not an array")
}

func TestPolicySelectorsToSelector_InvalidEntryType(t *testing.T) {
	data := map[string]any{
		"id":        "p1",
		"selectors": []any{"not-an-object"},
	}

	_, err := migrations.PolicySelectorsToSelector("policy", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not an object")
}

func TestPolicySelectorsToSelector_InvalidSubSelectorType(t *testing.T) {
	data := map[string]any{
		"id": "p1",
		"selectors": []any{
			map[string]any{
				"id":                 "s1",
				"deploymentSelector": "not-an-object",
			},
		},
	}

	_, err := migrations.PolicySelectorsToSelector("policy", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "deploymentSelector is not an object")
}

func TestPolicySelectorsToSelector_SelectorWithMissingCelField(t *testing.T) {
	data := toMap(t, `{
		"id": "p1",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"json": {"name": "web"}}
		}]
	}`)

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	// No CEL field means this sub-selector is skipped; entry matches everything
	assert.Equal(t, "true", result["selector"])
}

func TestPolicySelectorsToSelector_NonPolicyEntityType(t *testing.T) {
	data := map[string]any{
		"id":        "x1",
		"selectors": []any{map[string]any{"id": "s1"}},
	}

	result, err := migrations.PolicySelectorsToSelector("resource", data)
	require.NoError(t, err)
	// Should be a no-op for non-policy entity types
	assert.Nil(t, result["selector"])
	assert.NotNil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_TrueSubSelectorOmitted(t *testing.T) {
	data := map[string]any{
		"id":   "p1",
		"name": "test",
		"selectors": []any{
			map[string]any{
				"id":                    "s1",
				"deploymentSelector":    map[string]any{"cel": "deployment.name == 'web'"},
				"environmentSelector":   map[string]any{"cel": "true"},
				"resourceSelector":      map[string]any{"cel": "true"},
			},
		},
	}

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	// "true" sub-selectors should be omitted, leaving only the deployment part
	assert.Equal(t, "deployment.name == 'web'", result["selector"])
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_AllTrueSubSelectors(t *testing.T) {
	data := map[string]any{
		"id":   "p1",
		"name": "test",
		"selectors": []any{
			map[string]any{
				"id":                    "s1",
				"deploymentSelector":    map[string]any{"cel": "true"},
				"environmentSelector":   map[string]any{"cel": "true"},
			},
		},
	}

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)
	// All sub-selectors are "true" → no parts → entry matches everything → "true"
	assert.Equal(t, "true", result["selector"])
	assert.Nil(t, result["selectors"])
}

func TestPolicySelectorsToSelector_Roundtrip_WithMigrateRaw(t *testing.T) {
	input := `{
		"id": "p1",
		"name": "test",
		"selectors": [{
			"id": "s1",
			"deploymentSelector": {"cel": "deployment.name == 'web'"}
		}]
	}`

	var data map[string]any
	require.NoError(t, json.Unmarshal([]byte(input), &data))

	result, err := migrations.PolicySelectorsToSelector("policy", data)
	require.NoError(t, err)

	output, err := json.Marshal(result)
	require.NoError(t, err)

	var roundtrip map[string]any
	require.NoError(t, json.Unmarshal(output, &roundtrip))
	assert.Equal(t, "deployment.name == 'web'", roundtrip["selector"])
	assert.Nil(t, roundtrip["selectors"])
}
