package oapi

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTemplatableJob_Map(t *testing.T) {
	now := time.Now()
	job := &TemplatableJob{
		JobWithRelease: JobWithRelease{
			Job: Job{
				Id:        "job-123",
				ReleaseId: "release-456",
				Status:    JobStatusPending,
				CreatedAt: now,
				UpdatedAt: now,
			},
			Resource: &Resource{
				Id:         "resource-def",
				Name:       "my-app",
				Identifier: "my-app-identifier",
				Kind:       "Kubernetes",
				Version:    "1.0.0",
				Config: map[string]interface{}{
					"namespace": "production",
					"cluster":   "us-west-2",
				},
				Metadata: map[string]string{
					"team": "platform",
				},
			},
			Environment: &Environment{
				Id:   "env-abc",
				Name: "production",
			},
			Deployment: &Deployment{
				Id:   "deployment-789",
				Name: "my-deployment",
			},
		},
		Release: &TemplatableRelease{
			Release: Release{
				CreatedAt: now.Format(time.RFC3339),
				ReleaseTarget: ReleaseTarget{
					DeploymentId:  "deployment-789",
					EnvironmentId: "env-abc",
					ResourceId:    "resource-def",
				},
				Version: DeploymentVersion{
					Id:   "version-001",
					Name: "v1.2.3",
					Tag:  "v1.2.3",
				},
			},
			Variables: map[string]string{
				"IMAGE_TAG": "v1.2.3",
				"REPLICAS":  "3",
			},
		},
	}

	m := job.Map()
	require.NotNil(t, m)

	// Test lowercase resource fields
	resource, ok := m["resource"].(map[string]any)
	require.True(t, ok, "resource should be a map")
	assert.Equal(t, "my-app", resource["name"])
	assert.Equal(t, "my-app-identifier", resource["identifier"])
	assert.Equal(t, "Kubernetes", resource["kind"])

	// Test resource config
	config, ok := resource["config"].(map[string]any)
	require.True(t, ok, "resource.config should be a map")
	assert.Equal(t, "production", config["namespace"])
	assert.Equal(t, "us-west-2", config["cluster"])

	// Test lowercase environment fields
	environment, ok := m["environment"].(map[string]any)
	require.True(t, ok, "environment should be a map")
	assert.Equal(t, "production", environment["name"])

	// Test lowercase deployment fields
	deployment, ok := m["deployment"].(map[string]any)
	require.True(t, ok, "deployment should be a map")
	assert.Equal(t, "my-deployment", deployment["name"])

	// Test lowercase release fields
	release, ok := m["release"].(map[string]any)
	require.True(t, ok, "release should be a map")

	// Test release.version
	version, ok := release["version"].(map[string]any)
	require.True(t, ok, "release.version should be a map")
	assert.Equal(t, "v1.2.3", version["name"])
	assert.Equal(t, "v1.2.3", version["tag"])

	// Test release.variables
	variables, ok := release["variables"].(map[string]string)
	require.True(t, ok, "release.variables should be a map[string]string")
	assert.Equal(t, "v1.2.3", variables["IMAGE_TAG"])
	assert.Equal(t, "3", variables["REPLICAS"])

	// Test lowercase job fields
	jobMap, ok := m["job"].(map[string]any)
	require.True(t, ok, "job should be a map")
	assert.Equal(t, "job-123", jobMap["id"])
}

func TestTemplatableJob_Map_NilFields(t *testing.T) {
	now := time.Now()
	job := &TemplatableJob{
		JobWithRelease: JobWithRelease{
			Job: Job{
				Id:        "job-123",
				ReleaseId: "release-456",
				Status:    JobStatusPending,
				CreatedAt: now,
				UpdatedAt: now,
			},
			// Resource, Environment, Deployment are nil
		},
		// Release is nil
	}

	m := job.Map()
	require.NotNil(t, m)

	// Nil fields should not be present in the map
	_, ok := m["resource"]
	assert.False(t, ok, "resource should not be present when nil")

	_, ok = m["environment"]
	assert.False(t, ok, "environment should not be present when nil")

	_, ok = m["deployment"]
	assert.False(t, ok, "deployment should not be present when nil")

	_, ok = m["release"]
	assert.False(t, ok, "release should not be present when nil")

	// Job should always be present
	_, ok = m["job"]
	assert.True(t, ok, "job should always be present")
}

func TestStructToMap(t *testing.T) {
	resource := &Resource{
		Id:         "resource-123",
		Name:       "test-resource",
		Identifier: "test-identifier",
		Kind:       "Kubernetes",
		Version:    "1.0.0",
	}

	m := structToMap(resource)
	require.NotNil(t, m)

	// Verify lowercase keys from JSON tags
	assert.Equal(t, "resource-123", m["id"])
	assert.Equal(t, "test-resource", m["name"])
	assert.Equal(t, "test-identifier", m["identifier"])
	assert.Equal(t, "Kubernetes", m["kind"])
	assert.Equal(t, "1.0.0", m["version"])
}
