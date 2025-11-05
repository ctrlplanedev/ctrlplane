package diffcheck

import (
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
)

func TestHasResourceChanges_NoChanges(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Metadata: map[string]string{
			"env":  "prod",
			"team": "platform",
		},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Metadata: map[string]string{
			"env":  "prod",
			"team": "platform",
		},
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should have no changes when resources are identical")
}

func TestHasResourceChanges_NilInputs(t *testing.T) {
	sample := &oapi.Resource{
		Name:       "sample",
		Kind:       "deployment",
		Identifier: "id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	t.Run("nil-old", func(t *testing.T) {
		changes := HasResourceChanges(nil, sample)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("nil-new", func(t *testing.T) {
		changes := HasResourceChanges(sample, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})

	t.Run("both-nil", func(t *testing.T) {
		changes := HasResourceChanges(nil, nil)
		assert.Len(t, changes, 1)
		assert.True(t, changes["all"])
	})
}

func TestHasResourceChangesBasic_DetectsChanges(t *testing.T) {
	old := &oapi.Resource{
		Name:       "old",
		Kind:       "deployment",
		Identifier: "id-old",
		Version:    "v1",
		Config: map[string]interface{}{
			"image":   "nginx:v1",
			"enabled": true,
			"thread":  2,
			"nested": map[string]interface{}{
				"key": "value",
			},
		},
		Metadata: map[string]string{
			"team":   "dev",
			"region": "us-west",
		},
	}

	new := &oapi.Resource{
		Name:       "new",
		Kind:       "statefulset",
		Identifier: "id-new",
		Version:    "v2",
		Config: map[string]interface{}{
			"image":   "nginx:v2",
			"enabled": false,
			"extra":   1,
		},
		Metadata: map[string]string{
			"team":    "ops",
			"region2": "eu-central",
		},
	}

	changes := hasResourceChangesBasic(old, new)
	assert.True(t, changes["name"])
	assert.True(t, changes["kind"])
	assert.True(t, changes["identifier"])
	assert.True(t, changes["version"])
	assert.True(t, changes["config.image"])
	assert.True(t, changes["config.enabled"])
	assert.True(t, changes["config.thread"])
	assert.True(t, changes["config.nested"])
	assert.True(t, changes["config.extra"])
	assert.True(t, changes["metadata.team"])
	assert.True(t, changes["metadata.region"])
	assert.True(t, changes["metadata.region2"])
}

func TestHasResourceChanges_NameChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "old-name",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "new-name",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["name"], "Should detect name change")
}

func TestHasResourceChanges_KindChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "statefulset",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["kind"], "Should detect kind change")
}

func TestHasResourceChanges_IdentifierChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "old-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "new-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["identifier"], "Should detect identifier change")
}

func TestHasResourceChanges_VersionChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v2",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["version"], "Should detect version change")
}

func TestHasResourceChanges_ConfigValueChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:2.0",
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["config.image"], "Should detect config.image change")
}

func TestHasResourceChanges_ConfigKeyAdded(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["config.image"], "Should detect new config key")
}

func TestHasResourceChanges_ConfigKeyRemoved(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:latest",
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	// The implementation DOES detect when old config keys don't exist in new config
	assert.Len(t, changes, 1, "Should detect removed config key")
	assert.True(t, changes["config.image"], "Should detect config.image was removed")
}

func TestHasResourceChanges_MetadataValueChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env":  "staging",
			"team": "platform",
		},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env":  "production",
			"team": "platform",
		},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["metadata.env"], "Should detect metadata.env change")
}

func TestHasResourceChanges_MetadataKeyAdded(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env": "prod",
		},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env":  "prod",
			"team": "platform",
		},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should have exactly 1 change")
	assert.True(t, changes["metadata.team"], "Should detect new metadata key")
}

func TestHasResourceChanges_MetadataKeyRemoved(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env":  "prod",
			"team": "platform",
		},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env": "prod",
		},
	}

	changes := HasResourceChanges(old, new)
	// The implementation DOES detect when old metadata keys don't exist in new metadata
	assert.Len(t, changes, 1, "Should detect removed metadata key")
	assert.True(t, changes["metadata.team"], "Should detect metadata.team was removed")
}

func TestHasResourceChanges_MultipleChanges(t *testing.T) {
	old := &oapi.Resource{
		Name:       "old-name",
		Kind:       "deployment",
		Identifier: "old-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
			"image":    "nginx:1.0",
		},
		Metadata: map[string]string{
			"env":  "staging",
			"team": "platform",
		},
	}

	new := &oapi.Resource{
		Name:       "new-name",
		Kind:       "statefulset",
		Identifier: "new-id",
		Version:    "v2",
		Config: map[string]interface{}{
			"replicas": 5,
			"image":    "nginx:2.0",
		},
		Metadata: map[string]string{
			"env":    "production",
			"team":   "devops",
			"region": "us-east-1",
		},
	}

	changes := HasResourceChanges(old, new)

	// Should detect: name, kind, identifier, version, config.replicas, config.image, metadata.env, metadata.team, metadata.region
	assert.GreaterOrEqual(t, len(changes), 9, "Should detect multiple changes")

	// Verify specific changes
	assert.True(t, changes["name"], "Should detect name change")
	assert.True(t, changes["kind"], "Should detect kind change")
	assert.True(t, changes["identifier"], "Should detect identifier change")
	assert.True(t, changes["version"], "Should detect version change")
	assert.True(t, changes["config.replicas"], "Should detect config.replicas change")
	assert.True(t, changes["config.image"], "Should detect config.image change")
	assert.True(t, changes["metadata.env"], "Should detect metadata.env change")
	assert.True(t, changes["metadata.team"], "Should detect metadata.team change")
	assert.True(t, changes["metadata.region"], "Should detect new metadata.region")
}

func TestHasResourceChanges_EmptyMaps(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should have no changes with empty maps")
}

func TestHasResourceChanges_NilToPopulatedConfig(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     nil,
		Metadata:   map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should detect new config key")
	assert.True(t, changes["config.replicas"], "Should detect new config.replicas")
}

func TestHasResourceChanges_NilToPopulatedMetadata(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   nil,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata: map[string]string{
			"env": "prod",
		},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should detect new metadata key")
	assert.True(t, changes["metadata.env"], "Should detect new metadata.env")
}

func TestHasResourceChanges_ComplexConfigValues(t *testing.T) {
	// Note: The current implementation uses != to compare values,
	// which panics for uncomparable types like slices and maps.
	// This test uses comparable values only (strings, numbers, bools)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas":    3,
			"port":        8080,
			"enabled":     true,
			"description": "old description",
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas":    3,
			"port":        9090, // Changed
			"enabled":     true,
			"description": "old description",
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should detect config.port change")
	assert.True(t, changes["config.port"], "Should detect config.port change")
}

func TestHasResourceChanges_SlicesInConfig(t *testing.T) {
	// Test that the function handles slices in config values with deep path reporting
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"ports": []int{80, 443},
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"ports": []int{80, 443, 8080},
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should detect slice element added")
	assert.True(t, changes["config.ports.2"], "Should detect config.ports[2] array element added with full path")
}

func TestHasResourceChanges_SlicesUnchanged(t *testing.T) {
	// Test that identical slices are detected as unchanged
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"ports": []int{80, 443},
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"ports": []int{80, 443},
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should detect no changes when slices are identical")
}

func TestHasResourceChanges_SameValueDifferentType(t *testing.T) {
	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"port": "8080", // String
		},
		Metadata: map[string]string{},
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"port": 8080, // Integer
		},
		Metadata: map[string]string{},
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should detect type change in config value")
	assert.True(t, changes["config.port"], "Should detect config.port type change")
}

func TestHasResourceChanges_AllFieldsChanged(t *testing.T) {
	old := &oapi.Resource{
		Name:       "old-resource",
		Kind:       "old-kind",
		Identifier: "old-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"old-key": "old-value",
		},
		Metadata: map[string]string{
			"old-meta": "old-meta-value",
		},
	}

	new := &oapi.Resource{
		Name:       "new-resource",
		Kind:       "new-kind",
		Identifier: "new-id",
		Version:    "v2",
		Config: map[string]interface{}{
			"new-key": "new-value",
		},
		Metadata: map[string]string{
			"new-meta": "new-meta-value",
		},
	}

	changes := HasResourceChanges(old, new)

	// Should detect: name, kind, identifier, version, old-key removed (not detected), new-key added, old-meta removed (not detected), new-meta added
	assert.True(t, changes["name"], "Should detect name change")
	assert.True(t, changes["kind"], "Should detect kind change")
	assert.True(t, changes["identifier"], "Should detect identifier change")
	assert.True(t, changes["version"], "Should detect version change")
	assert.True(t, changes["config.new-key"], "Should detect new config key")
	assert.True(t, changes["metadata.new-meta"], "Should detect new metadata key")
}

func TestHasResourceChanges_DeeplyNestedConfigValues(t *testing.T) {
	// Test with deeply nested map structures
	// Now supports deep equality comparison for nested maps, slices, etc.

	t.Run("nested_map_same_content", func(t *testing.T) {
		// Nested maps with identical content should be detected as unchanged
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"database": map[string]interface{}{
					"host": "localhost",
					"port": 5432,
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"database": map[string]interface{}{
					"host": "localhost",
					"port": 5432,
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Empty(t, changes, "Should detect no changes when nested maps have identical content")
	})

	t.Run("nested_map_content_changed", func(t *testing.T) {
		// Nested content changed - should be detected with full path
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"database": map[string]interface{}{
					"host": "localhost",
					"port": 5432,
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"database": map[string]interface{}{
					"host": "prod-db.example.com", // Changed
					"port": 5432,
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 1, "Should detect nested config change")
		assert.True(t, changes["config.database.host"], "Should detect config.database.host changed with full nested path")
	})

	t.Run("multiple_nested_levels", func(t *testing.T) {
		// Multiple levels of nesting - should report full path
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"services": map[string]interface{}{
					"database": map[string]interface{}{
						"credentials": map[string]interface{}{
							"username": "admin",
							"password": "old-password",
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"services": map[string]interface{}{
					"database": map[string]interface{}{
						"credentials": map[string]interface{}{
							"username": "admin",
							"password": "new-password", // Deep change
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 1, "Should detect deeply nested change")
		assert.True(t, changes["config.services.database.credentials.password"], "Should detect full nested path config.services.database.credentials.password changed")
	})

	t.Run("deeply_nested_unchanged", func(t *testing.T) {
		// Multiple levels of nesting but no changes
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"services": map[string]interface{}{
					"database": map[string]interface{}{
						"credentials": map[string]interface{}{
							"username": "admin",
							"password": "secret",
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"services": map[string]interface{}{
					"database": map[string]interface{}{
						"credentials": map[string]interface{}{
							"username": "admin",
							"password": "secret", // Same
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Empty(t, changes, "Should detect no changes when deeply nested structures are identical")
	})

	t.Run("arrays_in_config", func(t *testing.T) {
		// Arrays/slices in config - reports element added with array index
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"ports":    []int{80, 443},
				"replicas": 3,
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"ports":    []int{80, 443, 8080}, // Element added
				"replicas": 3,
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 1, "Should detect array element added")
		assert.True(t, changes["config.ports.2"], "Should detect config.ports[2] added with full nested path")
	})

	t.Run("arrays_in_config_element_changed", func(t *testing.T) {
		// Arrays/slices in config - reports specific element changed with array index
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"ports": []int{80, 443, 8080},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"ports": []int{80, 443, 9090}, // Last element changed
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 1, "Should detect specific array element changed")
		assert.True(t, changes["config.ports.2"], "Should detect config.ports[2] changed with full nested path")
	})

	t.Run("mixed_nested_and_flat_changes", func(t *testing.T) {
		// Mix of flat and nested changes - should report full nested paths
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"replicas": 3,
				"image":    "nginx:1.0",
				"env": map[string]interface{}{
					"LOG_LEVEL": "info",
					"DEBUG":     false,
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"replicas": 5, // Changed
				"image":    "nginx:1.0",
				"env": map[string]interface{}{
					"LOG_LEVEL": "debug", // Changed (nested)
					"DEBUG":     true,    // Changed (nested)
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 3, "Should detect flat change and each nested change with full paths")
		assert.True(t, changes["config.replicas"], "Should detect config.replicas change")
		assert.True(t, changes["config.env.LOG_LEVEL"], "Should detect config.env.LOG_LEVEL changed with full path")
		assert.True(t, changes["config.env.DEBUG"], "Should detect config.env.DEBUG changed with full path")
	})

	t.Run("complex_nested_structures", func(t *testing.T) {
		// Test complex structures with arrays of maps - reports full path including array index
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"volumes": []interface{}{
					map[string]interface{}{
						"name":      "data",
						"mountPath": "/data",
					},
					map[string]interface{}{
						"name":      "logs",
						"mountPath": "/logs",
					},
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"volumes": []interface{}{
					map[string]interface{}{
						"name":      "data",
						"mountPath": "/data",
					},
					map[string]interface{}{
						"name":      "logs",
						"mountPath": "/var/logs", // Changed
					},
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Len(t, changes, 1, "Should detect change in array of maps")
		// The diff library reports array element changes with numeric indices
		assert.True(t, changes["config.volumes.1.mountPath"], "Should detect config.volumes[1].mountPath changed with full nested path")
	})

	t.Run("nested_structure_unchanged", func(t *testing.T) {
		// Complex nested structure but no changes
		old := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"deployment": map[string]interface{}{
					"strategy": "rolling",
					"volumes": []interface{}{
						map[string]interface{}{
							"name": "data",
							"size": "10Gi",
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		new := &oapi.Resource{
			Name:       "test-resource",
			Kind:       "deployment",
			Identifier: "test-id",
			Version:    "v1",
			Config: map[string]interface{}{
				"deployment": map[string]interface{}{
					"strategy": "rolling",
					"volumes": []interface{}{
						map[string]interface{}{
							"name": "data",
							"size": "10Gi",
						},
					},
				},
			},
			Metadata: map[string]string{},
		}

		changes := HasResourceChanges(old, new)
		assert.Empty(t, changes, "Should detect no changes when complex nested structures are identical")
	})
}

func TestHasResourceChanges_CreatedAtIgnored(t *testing.T) {
	oldTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	newTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		CreatedAt:  oldTime,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		CreatedAt:  newTime,
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should ignore CreatedAt field changes")
	assert.False(t, changes["createdat"], "Should not detect createdat change")
	assert.False(t, changes["createdAt"], "Should not detect createdAt change")
}

func TestHasResourceChanges_UpdatedAtIgnored(t *testing.T) {
	oldTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	newTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  &oldTime,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  &newTime,
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should ignore UpdatedAt field changes")
	assert.False(t, changes["updatedat"], "Should not detect updatedat change")
	assert.False(t, changes["updatedAt"], "Should not detect updatedAt change")
}

func TestHasResourceChanges_LockedAtIgnored(t *testing.T) {
	oldTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	newTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		LockedAt:   &oldTime,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		LockedAt:   &newTime,
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should ignore LockedAt field changes")
	assert.False(t, changes["lockedat"], "Should not detect lockedat change")
	assert.False(t, changes["lockedAt"], "Should not detect lockedAt change")
}

func TestHasResourceChanges_TimestampsIgnoredWithOtherChanges(t *testing.T) {
	oldTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	newTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 3,
		},
		Metadata:  map[string]string{},
		CreatedAt: oldTime,
		UpdatedAt: &oldTime,
		LockedAt:  &oldTime,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config: map[string]interface{}{
			"replicas": 5, // Changed
		},
		Metadata:  map[string]string{},
		CreatedAt: newTime,  // Changed but should be ignored
		UpdatedAt: &newTime, // Changed but should be ignored
		LockedAt:  &newTime, // Changed but should be ignored
	}

	changes := HasResourceChanges(old, new)
	assert.Len(t, changes, 1, "Should only detect config.replicas change, not timestamp changes")
	assert.True(t, changes["config.replicas"], "Should detect config.replicas change")
	assert.False(t, changes["createdat"], "Should not detect createdat change")
	assert.False(t, changes["createdAt"], "Should not detect createdAt change")
	assert.False(t, changes["updatedat"], "Should not detect updatedat change")
	assert.False(t, changes["updatedAt"], "Should not detect updatedAt change")
	assert.False(t, changes["lockedat"], "Should not detect lockedat change")
	assert.False(t, changes["lockedAt"], "Should not detect lockedAt change")
}

func TestHasResourceChanges_NilToSetTimestampsIgnored(t *testing.T) {
	newTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  nil,
		LockedAt:   nil,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  &newTime,
		LockedAt:   &newTime,
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should ignore timestamp changes from nil to set")
	assert.False(t, changes["updatedat"], "Should not detect updatedat change")
	assert.False(t, changes["updatedAt"], "Should not detect updatedAt change")
	assert.False(t, changes["lockedat"], "Should not detect lockedat change")
	assert.False(t, changes["lockedAt"], "Should not detect lockedAt change")
}

func TestHasResourceChanges_SetToNilTimestampsIgnored(t *testing.T) {
	oldTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  &oldTime,
		LockedAt:   &oldTime,
	}

	new := &oapi.Resource{
		Name:       "test-resource",
		Kind:       "deployment",
		Identifier: "test-id",
		Version:    "v1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
		UpdatedAt:  nil,
		LockedAt:   nil,
	}

	changes := HasResourceChanges(old, new)
	assert.Empty(t, changes, "Should ignore timestamp changes from set to nil")
	assert.False(t, changes["updatedat"], "Should not detect updatedat change")
	assert.False(t, changes["updatedAt"], "Should not detect updatedAt change")
	assert.False(t, changes["lockedat"], "Should not detect lockedat change")
	assert.False(t, changes["lockedAt"], "Should not detect lockedAt change")
}
