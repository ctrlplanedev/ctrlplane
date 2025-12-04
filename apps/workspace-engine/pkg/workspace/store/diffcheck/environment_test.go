package diffcheck

import (
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
)

func TestHasEnvironmentChanges_NoChanges(t *testing.T) {
	desc := "test description"
	old := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &desc,
		CreatedAt:   "2023-01-01T00:00:00Z",
		Id:          "env-123",
	}

	new := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &desc,
		CreatedAt:   "2023-01-01T00:00:00Z",
		Id:          "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Empty(t, changes, "Should have no changes when environments are identical")
}

func TestHasEnvironmentChanges_NilInputs(t *testing.T) {
	sample := &oapi.Environment{
		Name:     "sample",
		SystemId: "sys-1",
	}

	t.Run("nil-old", func(t *testing.T) {
		changes := HasEnvironmentChanges(nil, sample)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("nil-new", func(t *testing.T) {
		changes := HasEnvironmentChanges(sample, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("both-nil", func(t *testing.T) {
		changes := HasEnvironmentChanges(nil, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})
}

func TestHasEnvironmentChangesBasic_DetectsChanges(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	oldSelector := &oapi.Selector{}
	assert.NoError(t, oldSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"env": "prod",
		},
	}))

	newSelector := &oapi.Selector{}
	assert.NoError(t, newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"env":    "staging",
			"region": "us-east-1",
		},
	}))

	old := &oapi.Environment{
		Name:             "staging",
		SystemId:         "sys-old",
		Description:      &oldDesc,
		ResourceSelector: oldSelector,
	}

	new := &oapi.Environment{
		Name:             "production",
		SystemId:         "sys-new",
		Description:      &newDesc,
		ResourceSelector: newSelector,
	}

	changes := hasEnvironmentChangesBasic(old, new)
	assert.True(t, changes["name"])
	assert.True(t, changes["systemid"])
	assert.True(t, changes["description"])
	assert.True(t, changes["resourceselector"])
}

func TestHasEnvironmentChanges_NameChanged(t *testing.T) {
	old := &oapi.Environment{
		Name:     "staging",
		SystemId: "sys-123",
		Id:       "env-123",
	}

	new := &oapi.Environment{
		Name:     "production",
		SystemId: "sys-123",
		Id:       "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["name"], "Should detect name change")
}

func TestHasEnvironmentChanges_SystemIdChanged(t *testing.T) {
	old := &oapi.Environment{
		Name:     "production",
		SystemId: "sys-123",
		Id:       "env-123",
	}

	new := &oapi.Environment{
		Name:     "production",
		SystemId: "sys-456",
		Id:       "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["systemid"], "Should detect systemId change")
}

func TestHasEnvironmentChanges_DescriptionChanged(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	old := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &oldDesc,
		Id:          "env-123",
	}

	new := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &newDesc,
		Id:          "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["description"], "Should detect description change")
}

func TestHasEnvironmentChanges_DescriptionNilToSet(t *testing.T) {
	newDesc := "new description"

	old := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: nil,
		Id:          "env-123",
	}

	new := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &newDesc,
		Id:          "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect description added")
	assert.True(t, changes["description"], "Should detect description change from nil to set")
}

func TestHasEnvironmentChanges_DescriptionSetToNil(t *testing.T) {
	oldDesc := "old description"

	old := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: &oldDesc,
		Id:          "env-123",
	}

	new := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-123",
		Description: nil,
		Id:          "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should detect description removed")
	assert.True(t, changes["description"], "Should detect description change from set to nil")
}

func TestHasEnvironmentChanges_ResourceSelectorChanged(t *testing.T) {
	// Create selectors with JsonSelector
	oldSelector := &oapi.Selector{}
	_ = oldSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"env": "prod",
		},
	})

	newSelector := &oapi.Selector{}
	_ = newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"env": "staging",
		},
	})

	old := &oapi.Environment{
		Name:             "production",
		SystemId:         "sys-123",
		ResourceSelector: oldSelector,
		Id:               "env-123",
	}

	new := &oapi.Environment{
		Name:             "production",
		SystemId:         "sys-123",
		ResourceSelector: newSelector,
		Id:               "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.GreaterOrEqual(t, len(changes), 1, "Should detect resourceSelector change")
	// Check if any selector-related field changed
	hasResourceSelectorChange := false
	for key := range changes {
		if key == "resourceselector" || len(key) > len("resourceselector") && key[:len("resourceselector")] == "resourceselector" {
			hasResourceSelectorChange = true
			break
		}
	}
	assert.True(t, hasResourceSelectorChange, "Should detect resourceSelector change")
}

func TestHasEnvironmentChanges_ResourceSelectorNilToSet(t *testing.T) {
	newSelector := &oapi.Selector{}
	_ = newSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"env": "prod",
		},
	})

	old := &oapi.Environment{
		Name:             "production",
		SystemId:         "sys-123",
		ResourceSelector: nil,
		Id:               "env-123",
	}

	new := &oapi.Environment{
		Name:             "production",
		SystemId:         "sys-123",
		ResourceSelector: newSelector,
		Id:               "env-123",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.GreaterOrEqual(t, len(changes), 1, "Should detect resourceSelector added")
	assert.True(t, changes["resourceselector"], "Should detect resourceSelector added")
}

func TestHasEnvironmentChanges_MultipleChanges(t *testing.T) {
	oldDesc := "old description"
	newDesc := "new description"

	old := &oapi.Environment{
		Name:        "staging",
		SystemId:    "sys-123",
		Description: &oldDesc,
		Id:          "env-123",
		CreatedAt:   "2023-01-01T00:00:00Z",
	}

	new := &oapi.Environment{
		Name:        "production",
		SystemId:    "sys-456",
		Description: &newDesc,
		Id:          "env-123",              // Same ID (should be ignored)
		CreatedAt:   "2024-01-01T00:00:00Z", // Different CreatedAt (should be ignored)
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 3, "Should detect 3 changes (name, systemId, description)")
	assert.True(t, changes["name"], "Should detect name change")
	assert.True(t, changes["systemid"], "Should detect systemId change")
	assert.True(t, changes["description"], "Should detect description change")
	assert.False(t, changes["id"], "Should ignore id change")
	assert.False(t, changes["createdat"], "Should ignore createdAt change")
}

func TestHasEnvironmentChanges_IdIgnored(t *testing.T) {
	old := &oapi.Environment{
		Name:     "production",
		SystemId: "sys-123",
		Id:       "env-old",
	}

	new := &oapi.Environment{
		Name:     "production",
		SystemId: "sys-123",
		Id:       "env-new",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Empty(t, changes, "Should ignore id field changes")
	assert.False(t, changes["id"], "Should not detect id change")
}

func TestHasEnvironmentChanges_CreatedAtIgnored(t *testing.T) {
	old := &oapi.Environment{
		Name:      "production",
		SystemId:  "sys-123",
		Id:        "env-123",
		CreatedAt: "2023-01-01T00:00:00Z",
	}

	new := &oapi.Environment{
		Name:      "production",
		SystemId:  "sys-123",
		Id:        "env-123",
		CreatedAt: "2024-01-01T00:00:00Z",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Empty(t, changes, "Should ignore createdAt field changes")
	assert.False(t, changes["createdat"], "Should not detect createdAt change")
}

func TestHasEnvironmentChanges_SystemFieldsIgnoredWithOtherChanges(t *testing.T) {
	old := &oapi.Environment{
		Name:      "staging",
		SystemId:  "sys-123",
		Id:        "env-old",
		CreatedAt: "2023-01-01T00:00:00Z",
	}

	new := &oapi.Environment{
		Name:      "production",
		SystemId:  "sys-123",
		Id:        "env-new",
		CreatedAt: "2024-01-01T00:00:00Z",
	}

	changes := HasEnvironmentChanges(old, new)
	assert.Len(t, changes, 1, "Should only detect name change, not system field changes")
	assert.True(t, changes["name"], "Should detect name change")
	assert.False(t, changes["id"], "Should not detect id change")
	assert.False(t, changes["createdat"], "Should not detect createdAt change")
}
