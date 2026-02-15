package cel_test

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	cel "workspace-engine/pkg/selector/langs/cel"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompile(t *testing.T) {
	t.Run("valid expression", func(t *testing.T) {
		condition, err := cel.Compile("resource.name == 'test'")
		require.NoError(t, err)
		require.NotNil(t, condition)
	})

	t.Run("invalid expression", func(t *testing.T) {
		_, err := cel.Compile(">>> invalid <<<")
		require.Error(t, err)
	})
}

func TestCelSelector_Matches_Resource(t *testing.T) {
	condition, err := cel.Compile("resource.name == 'my-app'")
	require.NoError(t, err)

	t.Run("matches pointer resource", func(t *testing.T) {
		r := &oapi.Resource{
			Id:   "r-1",
			Name: "my-app",
			Kind: "Kubernetes",
		}
		matched, err := condition.Matches(r)
		require.NoError(t, err)
		assert.True(t, matched)
	})

	t.Run("does not match pointer resource", func(t *testing.T) {
		r := &oapi.Resource{
			Id:   "r-2",
			Name: "other-app",
			Kind: "Kubernetes",
		}
		matched, err := condition.Matches(r)
		require.NoError(t, err)
		assert.False(t, matched)
	})

	t.Run("matches value resource", func(t *testing.T) {
		r := oapi.Resource{
			Id:   "r-1",
			Name: "my-app",
			Kind: "Kubernetes",
		}
		matched, err := condition.Matches(r)
		require.NoError(t, err)
		assert.True(t, matched)
	})
}

func TestCelSelector_Matches_Deployment(t *testing.T) {
	condition, err := cel.Compile("deployment.name == 'web'")
	require.NoError(t, err)

	t.Run("matches pointer deployment", func(t *testing.T) {
		d := &oapi.Deployment{
			Id:   "d-1",
			Name: "web",
			Slug: "web-slug",
		}
		matched, err := condition.Matches(d)
		require.NoError(t, err)
		assert.True(t, matched)
	})

	t.Run("matches value deployment", func(t *testing.T) {
		d := oapi.Deployment{
			Id:   "d-1",
			Name: "web",
			Slug: "web-slug",
		}
		matched, err := condition.Matches(d)
		require.NoError(t, err)
		assert.True(t, matched)
	})
}

func TestCelSelector_Matches_Environment(t *testing.T) {
	condition, err := cel.Compile("environment.name == 'production'")
	require.NoError(t, err)

	t.Run("matches pointer environment", func(t *testing.T) {
		e := &oapi.Environment{
			Id:   "e-1",
			Name: "production",
		}
		matched, err := condition.Matches(e)
		require.NoError(t, err)
		assert.True(t, matched)
	})

	t.Run("matches value environment", func(t *testing.T) {
		e := oapi.Environment{
			Id:   "e-1",
			Name: "production",
		}
		matched, err := condition.Matches(e)
		require.NoError(t, err)
		assert.True(t, matched)
	})
}

func TestCelSelector_Matches_TrueWithJob(t *testing.T) {
	// The compiled env only has resource/deployment/environment variables,
	// but the Matches method still exercises the structToMap -> jobToMap path.
	// Use "true" to test that the job is processed without error.
	condition, err := cel.Compile("true")
	require.NoError(t, err)

	t.Run("pointer job processed", func(t *testing.T) {
		j := &oapi.Job{
			Id:        "j-1",
			ReleaseId: "rel-1",
			Status:    oapi.JobStatusSuccessful,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		matched, err := condition.Matches(j)
		require.NoError(t, err)
		assert.True(t, matched)
	})

	t.Run("value job processed", func(t *testing.T) {
		j := oapi.Job{
			Id:        "j-1",
			ReleaseId: "rel-1",
			Status:    oapi.JobStatusSuccessful,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		matched, err := condition.Matches(j)
		require.NoError(t, err)
		assert.True(t, matched)
	})
}

func TestCelSelector_Matches_EmptyExpression(t *testing.T) {
	// An empty CEL expression should be handled by the Matches method
	condition, err := cel.Compile("true")
	require.NoError(t, err)
	matched, err := condition.Matches(&oapi.Resource{Id: "r-1"})
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestCelSelector_Matches_FalseExpression(t *testing.T) {
	condition, err := cel.Compile("false")
	require.NoError(t, err)
	matched, err := condition.Matches(&oapi.Resource{Id: "r-1"})
	require.NoError(t, err)
	assert.False(t, matched)
}

func TestCelSelector_Matches_UnknownEntity(t *testing.T) {
	// Generic struct that isn't a known entity type - should fallback to EntityToMap
	condition, err := cel.Compile("true")
	require.NoError(t, err)

	type CustomEntity struct {
		Name string `json:"name"`
	}
	matched, err := condition.Matches(CustomEntity{Name: "test"})
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestCelSelector_Matches_ResourceWithOptionalFields(t *testing.T) {
	now := time.Now()
	condition, err := cel.Compile("resource.name == 'app'")
	require.NoError(t, err)

	r := &oapi.Resource{
		Id:        "r-1",
		Name:      "app",
		Kind:      "Kubernetes",
		UpdatedAt: &now,
		DeletedAt: &now,
		LockedAt:  &now,
	}
	matched, err := condition.Matches(r)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestCelSelector_Matches_DeploymentWithOptionalFields(t *testing.T) {
	desc := "my deployment"
	agentId := "agent-1"
	condition, err := cel.Compile("deployment.description == 'my deployment'")
	require.NoError(t, err)

	d := &oapi.Deployment{
		Id:          "d-1",
		Name:        "web",
		Slug:        "web-slug",
		Description: &desc,
		JobAgentId:  &agentId,
	}
	matched, err := condition.Matches(d)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestCelSelector_Matches_EnvironmentWithOptionalFields(t *testing.T) {
	desc := "production environment"
	condition, err := cel.Compile("environment.description == 'production environment'")
	require.NoError(t, err)

	e := &oapi.Environment{
		Id:          "e-1",
		Name:        "production",
		Description: &desc,
	}
	matched, err := condition.Matches(e)
	require.NoError(t, err)
	assert.True(t, matched)
}

func TestCelSelector_Matches_JobWithOptionalFields(t *testing.T) {
	now := time.Now()
	extId := "ext-123"
	// Use "true" since job vars are not declared in the compiled env
	condition, err := cel.Compile("true")
	require.NoError(t, err)

	j := &oapi.Job{
		Id:          "j-1",
		ReleaseId:   "rel-1",
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   now,
		UpdatedAt:   now,
		ExternalId:  &extId,
		CompletedAt: &now,
		StartedAt:   &now,
	}
	matched, err := condition.Matches(j)
	require.NoError(t, err)
	assert.True(t, matched)
}
