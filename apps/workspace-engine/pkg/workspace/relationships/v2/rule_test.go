package v2

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelationshipRule_Match_CEL_True(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.name == to.name"},
	}

	from := map[string]any{"type": "resource", "id": "r1", "name": "app"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "app"}

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_CEL_False(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.name == to.name"},
	}

	from := map[string]any{"type": "resource", "id": "r1", "name": "frontend"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "backend"}

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.False(t, matched)
}

func TestRelationshipRule_Match_InvalidCEL(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "invalid $$$ expression"},
	}

	from := map[string]any{"type": "resource", "id": "r1", "name": "app"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "app"}

	_, err := rule.Match(from, to)
	assert.Error(t, err)
}

func TestRelationshipRule_Match_AlwaysTrue(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "true"},
	}

	from := map[string]any{"type": "resource", "id": "r1", "name": "anything"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "different"}

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_TypeField(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.type == 'resource' && to.type == 'deployment'"},
	}

	from := map[string]any{"type": "resource", "id": "r1", "name": "app"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "app"}

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_EnvironmentEntity(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.type == 'environment'"},
	}

	from := map[string]any{"type": "environment", "id": "env-1", "name": "production", "systemId": "system-1"}
	to := map[string]any{"type": "deployment", "id": "d1", "name": "app"}

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}
