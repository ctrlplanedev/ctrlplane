package persistence_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"workspace-engine/pkg/persistence"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testEntity is a minimal entity used for registry tests.
type testEntity struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}

func (e *testEntity) CompactionKey() (string, string) {
	return "test", e.Name
}

func TestJSONEntityRegistry_Register_And_Unmarshal(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity { return &testEntity{} })

	data := json.RawMessage(`{"name":"foo","value":42}`)
	entity, err := reg.Unmarshal("test", data)
	require.NoError(t, err)

	te, ok := entity.(*testEntity)
	require.True(t, ok)
	assert.Equal(t, "foo", te.Name)
	assert.Equal(t, 42, te.Value)
}

func TestJSONEntityRegistry_Unmarshal_UnregisteredType(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()

	data := json.RawMessage(`{"name":"foo"}`)
	_, err := reg.Unmarshal("unknown", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no factory registered")
}

func TestJSONEntityRegistry_RegisterMigration_AppliesDuringUnmarshal(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity { return &testEntity{} })

	reg.RegisterMigration("test", persistence.Migration{
		Name: "double_value",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if v, ok := data["value"].(float64); ok {
				data["value"] = v * 2
			}
			return data, nil
		},
	})

	data := json.RawMessage(`{"name":"bar","value":5}`)
	entity, err := reg.Unmarshal("test", data)
	require.NoError(t, err)

	te := entity.(*testEntity)
	assert.Equal(t, 10, te.Value)
}

func TestJSONEntityRegistry_MultipleMigrations_RunInOrder(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity { return &testEntity{} })

	// First migration: add 10
	reg.RegisterMigration("test", persistence.Migration{
		Name: "add_10",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if v, ok := data["value"].(float64); ok {
				data["value"] = v + 10
			}
			return data, nil
		},
	})

	// Second migration: multiply by 3
	reg.RegisterMigration("test", persistence.Migration{
		Name: "multiply_3",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if v, ok := data["value"].(float64); ok {
				data["value"] = v * 3
			}
			return data, nil
		},
	})

	// Input value 5 -> add 10 = 15 -> multiply 3 = 45
	data := json.RawMessage(`{"name":"order","value":5}`)
	entity, err := reg.Unmarshal("test", data)
	require.NoError(t, err)

	te := entity.(*testEntity)
	assert.Equal(t, 45, te.Value)
}

func TestJSONEntityRegistry_MigrateRaw_NoMigrations(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()

	input := json.RawMessage(`{"name":"untouched","value":1}`)
	output, err := reg.MigrateRaw("test", input)
	require.NoError(t, err)
	assert.JSONEq(t, string(input), string(output))
}

func TestJSONEntityRegistry_MigrateRaw_TransformsJSON(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()

	reg.RegisterMigration("test", persistence.Migration{
		Name: "rename_field",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if old, ok := data["old_name"]; ok {
				data["name"] = old
				delete(data, "old_name")
			}
			return data, nil
		},
	})

	input := json.RawMessage(`{"old_name":"migrated","value":99}`)
	output, err := reg.MigrateRaw("test", input)
	require.NoError(t, err)

	var result map[string]any
	require.NoError(t, json.Unmarshal(output, &result))
	assert.Equal(t, "migrated", result["name"])
	assert.Nil(t, result["old_name"])
	assert.Equal(t, float64(99), result["value"])
}

func TestJSONEntityRegistry_MigrateRaw_ErrorPropagates(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()

	reg.RegisterMigration("test", persistence.Migration{
		Name: "always_fail",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			return nil, fmt.Errorf("intentional error")
		},
	})

	input := json.RawMessage(`{"name":"fail"}`)
	_, err := reg.MigrateRaw("test", input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "always_fail")
	assert.Contains(t, err.Error(), "intentional error")
}

func TestJSONEntityRegistry_MigrateRaw_InvalidJSON(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()

	reg.RegisterMigration("test", persistence.Migration{
		Name: "noop",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			return data, nil
		},
	})

	input := json.RawMessage(`not valid json`)
	_, err := reg.MigrateRaw("test", input)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to unmarshal raw JSON")
}

func TestJSONEntityRegistry_Migration_OnlyAffectsRegisteredType(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity { return &testEntity{} })

	reg.RegisterMigration("other_type", persistence.Migration{
		Name: "should_not_run",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			return nil, fmt.Errorf("should not be called")
		},
	})

	data := json.RawMessage(`{"name":"safe","value":1}`)
	entity, err := reg.Unmarshal("test", data)
	require.NoError(t, err)

	te := entity.(*testEntity)
	assert.Equal(t, "safe", te.Name)
	assert.Equal(t, 1, te.Value)
}

func TestJSONEntityRegistry_IsRegistered(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	assert.False(t, reg.IsRegistered("test"))

	reg.Register("test", func() persistence.Entity { return &testEntity{} })
	assert.True(t, reg.IsRegistered("test"))
	assert.False(t, reg.IsRegistered("other"))
}

func TestJSONEntityRegistry_Migration_AddField(t *testing.T) {
	type entityV2 struct {
		Name    string `json:"name"`
		Value   int    `json:"value"`
		NewFlag bool   `json:"new_flag"`
	}

	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity {
		return &testEntity{}
	})

	// Migration that sets a default for a new field
	reg.RegisterMigration("test", persistence.Migration{
		Name: "add_new_flag",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if _, ok := data["new_flag"]; !ok {
				data["new_flag"] = true
			}
			return data, nil
		},
	})

	// The raw JSON should have new_flag after migration
	input := json.RawMessage(`{"name":"evolved","value":7}`)
	output, err := reg.MigrateRaw("test", input)
	require.NoError(t, err)

	var result entityV2
	require.NoError(t, json.Unmarshal(output, &result))
	assert.Equal(t, "evolved", result.Name)
	assert.Equal(t, 7, result.Value)
	assert.True(t, result.NewFlag)
}

func TestJSONEntityRegistry_Migration_IdempotentIfAlreadyMigrated(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("test", func() persistence.Entity { return &testEntity{} })

	reg.RegisterMigration("test", persistence.Migration{
		Name: "set_default_value",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if _, ok := data["value"]; !ok {
				data["value"] = float64(100)
			}
			return data, nil
		},
	})

	// Already has value -- migration should be a no-op
	data := json.RawMessage(`{"name":"existing","value":42}`)
	entity, err := reg.Unmarshal("test", data)
	require.NoError(t, err)

	te := entity.(*testEntity)
	assert.Equal(t, 42, te.Value)
}

// policyEntity is a minimal policy-like entity used to test the migration
// end-to-end through the registry without importing the oapi package.
type policyEntity struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	Selector string `json:"selector"`
}

func (p *policyEntity) CompactionKey() (string, string) {
	return "policy", p.Id
}

func TestJSONEntityRegistry_PolicyMigration_EndToEnd_OldFormat(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("policy", func() persistence.Entity { return &policyEntity{} })

	reg.RegisterMigration("policy", persistence.Migration{
		Name: "selectors_to_selector",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if entityType != "policy" {
				return data, nil
			}
			if _, ok := data["selector"]; ok {
				return data, nil
			}
			data["selector"] = "true"
			delete(data, "selectors")
			return data, nil
		},
	})

	// Old-format JSON with selectors array
	oldJSON := json.RawMessage(`{
		"id": "p1",
		"name": "my-policy",
		"selectors": [{"id": "s1"}]
	}`)

	entity, err := reg.Unmarshal("policy", oldJSON)
	require.NoError(t, err)

	pe, ok := entity.(*policyEntity)
	require.True(t, ok)
	assert.Equal(t, "p1", pe.Id)
	assert.Equal(t, "my-policy", pe.Name)
	assert.Equal(t, "true", pe.Selector)
}

func TestJSONEntityRegistry_PolicyMigration_EndToEnd_NewFormat(t *testing.T) {
	reg := persistence.NewJSONEntityRegistry()
	reg.Register("policy", func() persistence.Entity { return &policyEntity{} })

	reg.RegisterMigration("policy", persistence.Migration{
		Name: "selectors_to_selector",
		Migrate: func(entityType string, data map[string]any) (map[string]any, error) {
			if entityType != "policy" {
				return data, nil
			}
			if _, ok := data["selector"]; ok {
				return data, nil
			}
			data["selector"] = "true"
			delete(data, "selectors")
			return data, nil
		},
	})

	// New-format JSON already has selector string
	newJSON := json.RawMessage(`{
		"id": "p2",
		"name": "new-policy",
		"selector": "deployment.name == 'web'"
	}`)

	entity, err := reg.Unmarshal("policy", newJSON)
	require.NoError(t, err)

	pe, ok := entity.(*policyEntity)
	require.True(t, ok)
	assert.Equal(t, "p2", pe.Id)
	assert.Equal(t, "new-policy", pe.Name)
	assert.Equal(t, "deployment.name == 'web'", pe.Selector)
}
