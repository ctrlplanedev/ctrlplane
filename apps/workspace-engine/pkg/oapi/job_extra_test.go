package oapi

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLiteralValue_String(t *testing.T) {
	t.Run("string value", func(t *testing.T) {
		lv := &LiteralValue{}
		_ = lv.FromStringValue("hello")
		assert.Equal(t, "hello", lv.String())
	})

	t.Run("boolean value", func(t *testing.T) {
		lv := &LiteralValue{}
		_ = lv.FromBooleanValue(true)
		assert.Equal(t, "true", lv.String())
	})

	t.Run("number value", func(t *testing.T) {
		lv := &LiteralValue{}
		_ = lv.FromNumberValue(3.14)
		result := lv.String()
		assert.NotEmpty(t, result)
	})

	t.Run("integer value", func(t *testing.T) {
		lv := &LiteralValue{}
		_ = lv.FromIntegerValue(42)
		result := lv.String()
		assert.Contains(t, result, "42")
	})

	t.Run("empty union returns empty", func(t *testing.T) {
		lv := &LiteralValue{}
		assert.Equal(t, "", lv.String())
	})
}

func TestRelease_ToTemplatable(t *testing.T) {
	t.Run("basic release", func(t *testing.T) {
		release := &Release{
			CreatedAt: time.Now().Format(time.RFC3339),
			ReleaseTarget: ReleaseTarget{
				DeploymentId:  "dep-1",
				EnvironmentId: "env-1",
				ResourceId:    "res-1",
			},
			Version: DeploymentVersion{
				Id:   "v-1",
				Name: "v1.0",
				Tag:  "v1.0",
			},
			Variables: map[string]LiteralValue{},
		}

		// Add variables
		lv := LiteralValue{}
		_ = lv.FromStringValue("my-image:latest")
		release.Variables["IMAGE"] = lv

		templatable, err := release.ToTemplatable()
		require.NoError(t, err)
		assert.Equal(t, "my-image:latest", templatable.Variables["IMAGE"])
	})
}

func TestJobWithRelease_ToTemplatable(t *testing.T) {
	now := time.Now()
	lv := LiteralValue{}
	_ = lv.FromStringValue("value")

	job := &JobWithRelease{
		Job: Job{
			Id:        "job-1",
			ReleaseId: "release-1",
			Status:    JobStatusPending,
			CreatedAt: now,
			UpdatedAt: now,
		},
		Release: Release{
			CreatedAt: now.Format(time.RFC3339),
			ReleaseTarget: ReleaseTarget{
				DeploymentId:  "dep-1",
				EnvironmentId: "env-1",
				ResourceId:    "res-1",
			},
			Version: DeploymentVersion{
				Id:   "v-1",
				Name: "v1.0",
				Tag:  "v1.0",
			},
			Variables: map[string]LiteralValue{"KEY": lv},
		},
	}

	templatable, err := job.ToTemplatable()
	require.NoError(t, err)
	require.NotNil(t, templatable)
	assert.Equal(t, "value", templatable.Release.Variables["KEY"])
}

func TestJob_GetArgoCDJobAgentConfig(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		job := &Job{
			Id: "job-1",
			JobAgentConfig: map[string]any{
				"serverUrl": "https://argocd.example.com",
				"apiKey":    "my-key",
				"template":  "my-template",
			},
		}
		cfg, err := job.GetArgoCDJobAgentConfig()
		require.NoError(t, err)
		assert.Equal(t, "https://argocd.example.com", cfg.ServerUrl)
		assert.Equal(t, "my-key", cfg.ApiKey)
		assert.Equal(t, "my-template", cfg.Template)
	})

	t.Run("missing fields", func(t *testing.T) {
		job := &Job{
			Id:             "job-1",
			JobAgentConfig: map[string]any{},
		}
		_, err := job.GetArgoCDJobAgentConfig()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "missing required")
	})
}

func TestJob_GetGithubJobAgentConfig(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		job := &Job{
			Id: "job-1",
			JobAgentConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "my-org",
				"repo":           "my-repo",
				"workflowId":     float64(67890),
			},
		}
		cfg, err := job.GetGithubJobAgentConfig()
		require.NoError(t, err)
		assert.Equal(t, 12345, cfg.InstallationId)
		assert.Equal(t, "my-org", cfg.Owner)
		assert.Equal(t, "my-repo", cfg.Repo)
	})

	t.Run("missing fields", func(t *testing.T) {
		job := &Job{
			Id:             "job-1",
			JobAgentConfig: map[string]any{},
		}
		_, err := job.GetGithubJobAgentConfig()
		require.Error(t, err)
	})
}

func TestJob_GetTerraformCloudJobAgentConfig(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		job := &Job{
			Id: "job-1",
			JobAgentConfig: map[string]any{
				"address":      "https://app.terraform.io",
				"organization": "my-org",
				"token":        "my-token",
				"template":     "my-template",
			},
		}
		cfg, err := job.GetTerraformCloudJobAgentConfig()
		require.NoError(t, err)
		assert.Equal(t, "https://app.terraform.io", cfg.Address)
		assert.Equal(t, "my-org", cfg.Organization)
	})

	t.Run("missing fields", func(t *testing.T) {
		job := &Job{
			Id:             "job-1",
			JobAgentConfig: map[string]any{},
		}
		_, err := job.GetTerraformCloudJobAgentConfig()
		require.Error(t, err)
	})
}

func TestJob_GetTestRunnerJobAgentConfig(t *testing.T) {
	job := &Job{
		Id: "job-1",
		JobAgentConfig: map[string]any{
			"someField": "someValue",
		},
	}
	cfg, err := job.GetTestRunnerJobAgentConfig()
	require.NoError(t, err)
	require.NotNil(t, cfg)
}

func TestDispatchContext_Map(t *testing.T) {
	d := &DispatchContext{
		Deployment: &Deployment{
			Id:   "dep-1",
			Name: "my-deployment",
		},
		Environment: &Environment{
			Id:   "env-1",
			Name: "production",
		},
		Resource: &Resource{
			Id:   "res-1",
			Name: "my-resource",
		},
	}
	m := d.Map()
	require.NotNil(t, m)
	dep, ok := m["deployment"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "dep-1", dep["id"])
}

func TestDispatchContext_Map_Nil(t *testing.T) {
	d := &DispatchContext{}
	m := d.Map()
	require.NotNil(t, m)
}
