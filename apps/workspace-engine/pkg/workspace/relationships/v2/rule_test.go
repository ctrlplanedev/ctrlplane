package v2

import (
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelationshipRule_Match_CEL_True(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.name == to.name"},
	}

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")

	from := relationships.NewResourceEntity(r)
	to := relationships.NewDeploymentEntity(d)

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_CEL_False(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.name == to.name"},
	}

	r := makeResource("r1", "frontend")
	d := makeDeployment("d1", "backend")

	from := relationships.NewResourceEntity(r)
	to := relationships.NewDeploymentEntity(d)

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.False(t, matched)
}

func TestRelationshipRule_Match_InvalidCEL(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "invalid $$$ expression"},
	}

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")

	from := relationships.NewResourceEntity(r)
	to := relationships.NewDeploymentEntity(d)

	_, err := rule.Match(from, to)
	assert.Error(t, err)
}

func TestRelationshipRule_Match_AlwaysTrue(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "true"},
	}

	r := makeResource("r1", "anything")
	d := makeDeployment("d1", "different")

	from := relationships.NewResourceEntity(r)
	to := relationships.NewDeploymentEntity(d)

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_TypeField(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.type == 'resource' && to.type == 'deployment'"},
	}

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")

	from := relationships.NewResourceEntity(r)
	to := relationships.NewDeploymentEntity(d)

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestRelationshipRule_Match_EnvironmentEntity(t *testing.T) {
	rule := &RelationshipRule{
		ID:      "r1",
		Matcher: oapi.CelMatcher{Cel: "from.type == 'environment'"},
	}

	env := &oapi.Environment{
		Id:       "env-1",
		Name:     "production",
		SystemId: "system-1",
	}
	d := makeDeployment("d1", "app")

	from := relationships.NewEnvironmentEntity(env)
	to := relationships.NewDeploymentEntity(d)

	matched, err := rule.Match(from, to)
	require.NoError(t, err)
	assert.True(t, matched)
}
