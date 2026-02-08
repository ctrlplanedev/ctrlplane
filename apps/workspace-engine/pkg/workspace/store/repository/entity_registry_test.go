package repository

import (
	"encoding/json"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGlobalRegistry_PolicyMigration_OldFormat(t *testing.T) {
	reg := GlobalRegistry()

	// Old-format policy JSON with selectors[] array
	oldJSON := json.RawMessage(`{
		"id": "policy-test-1",
		"name": "old-format-policy",
		"enabled": true,
		"priority": 1,
		"metadata": {},
		"createdAt": "2024-01-01T00:00:00Z",
		"workspaceId": "ws-1",
		"rules": [],
		"selectors": [
			{
				"id": "s1",
				"deploymentSelector": {"cel": "deployment.name == 'web'"},
				"environmentSelector": {"cel": "environment.name == 'prod'"}
			}
		]
	}`)

	entity, err := reg.Unmarshal("policy", oldJSON)
	require.NoError(t, err)

	policy, ok := entity.(*oapi.Policy)
	require.True(t, ok, "should unmarshal into *oapi.Policy")
	assert.Equal(t, "policy-test-1", policy.Id)
	assert.Equal(t, "old-format-policy", policy.Name)
	assert.Equal(t, "(deployment.name == 'web') && (environment.name == 'prod')", policy.Selector)
}

func TestGlobalRegistry_PolicyMigration_OldFormatMultipleSelectors(t *testing.T) {
	reg := GlobalRegistry()

	// Old-format with multiple selectors that should be ORed
	oldJSON := json.RawMessage(`{
		"id": "policy-test-2",
		"name": "multi-selector-policy",
		"enabled": true,
		"priority": 1,
		"metadata": {},
		"createdAt": "2024-01-01T00:00:00Z",
		"workspaceId": "ws-1",
		"rules": [],
		"selectors": [
			{"id": "s1", "deploymentSelector": {"cel": "deployment.name == 'web'"}},
			{"id": "s2", "deploymentSelector": {"cel": "deployment.name == 'api'"}}
		]
	}`)

	entity, err := reg.Unmarshal("policy", oldJSON)
	require.NoError(t, err)

	policy, ok := entity.(*oapi.Policy)
	require.True(t, ok)
	assert.Equal(t, "(deployment.name == 'web') || (deployment.name == 'api')", policy.Selector)
}

func TestGlobalRegistry_PolicyMigration_NewFormatPassthrough(t *testing.T) {
	reg := GlobalRegistry()

	// New-format policy JSON already has selector string
	newJSON := json.RawMessage(`{
		"id": "policy-test-3",
		"name": "new-format-policy",
		"enabled": true,
		"priority": 1,
		"metadata": {},
		"createdAt": "2024-01-01T00:00:00Z",
		"workspaceId": "ws-1",
		"rules": [],
		"selector": "environment.name == 'staging'"
	}`)

	entity, err := reg.Unmarshal("policy", newJSON)
	require.NoError(t, err)

	policy, ok := entity.(*oapi.Policy)
	require.True(t, ok)
	assert.Equal(t, "environment.name == 'staging'", policy.Selector)
}

func TestGlobalRegistry_PolicyMigration_EmptySelectors(t *testing.T) {
	reg := GlobalRegistry()

	// Old-format with empty selectors array → should default to "true"
	oldJSON := json.RawMessage(`{
		"id": "policy-test-4",
		"name": "empty-selectors",
		"enabled": true,
		"priority": 1,
		"metadata": {},
		"createdAt": "2024-01-01T00:00:00Z",
		"workspaceId": "ws-1",
		"rules": [],
		"selectors": []
	}`)

	entity, err := reg.Unmarshal("policy", oldJSON)
	require.NoError(t, err)

	policy, ok := entity.(*oapi.Policy)
	require.True(t, ok)
	assert.Equal(t, "true", policy.Selector)
}
