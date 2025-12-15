package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	integration "workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/require"
)

// These tests verify that CreatedAt and UpdatedAt timestamps are set correctly
// when entities are processed through the event queue. This is critical for
// the selector match cache to work properly, as it uses these timestamps
// to detect entity changes and invalidate stale cache entries.

func TestEngine_Resource_TimestampsForCache(t *testing.T) {
	providerID := "timestamp-test-provider"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Timestamp Test Provider"),
		),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	t.Run("new resource has CreatedAt set", func(t *testing.T) {
		beforeCreate := time.Now()

		resource := &oapi.Resource{
			Identifier: "ts-res-1",
			Name:       "Timestamp Resource 1",
			Kind:       "TestKind",
			Config:     map[string]any{},
			Metadata:   map[string]string{},
		}

		cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource})

		r, exists := ws.Resources().GetByIdentifier("ts-res-1")
		require.True(t, exists)
		require.False(t, r.CreatedAt.IsZero(), "CreatedAt should be set")
		require.True(t, r.CreatedAt.After(beforeCreate) || r.CreatedAt.Equal(beforeCreate),
			"CreatedAt should be >= test start time")
		// Note: SET operation sets UpdatedAt even on new resources for consistency
		// This is fine for cache purposes - we always have a timestamp to use
	})

	t.Run("updated resource has UpdatedAt updated", func(t *testing.T) {
		// Get original resource
		original, exists := ws.Resources().GetByIdentifier("ts-res-1")
		require.True(t, exists)
		originalCreatedAt := original.CreatedAt
		originalUpdatedAt := original.UpdatedAt

		// Small delay to ensure different timestamp
		time.Sleep(10 * time.Millisecond)

		// Update the resource
		updatedResource := &oapi.Resource{
			Identifier: "ts-res-1",
			Name:       "Timestamp Resource 1 Updated",
			Kind:       "TestKind",
			Config:     map[string]any{"updated": true},
			Metadata:   map[string]string{},
		}

		cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{updatedResource})

		r, exists := ws.Resources().GetByIdentifier("ts-res-1")
		require.True(t, exists)
		require.Equal(t, originalCreatedAt, r.CreatedAt, "CreatedAt should not change on update")
		require.NotNil(t, r.UpdatedAt, "UpdatedAt should be set after update")
		require.True(t, r.UpdatedAt.After(*originalUpdatedAt),
			"UpdatedAt should be later than previous UpdatedAt")
	})

	t.Run("metadata change triggers UpdatedAt change", func(t *testing.T) {
		// Get current UpdatedAt
		current, exists := ws.Resources().GetByIdentifier("ts-res-1")
		require.True(t, exists)
		previousUpdatedAt := current.UpdatedAt

		time.Sleep(10 * time.Millisecond)

		// Update only metadata
		metadataUpdated := &oapi.Resource{
			Identifier: "ts-res-1",
			Name:       "Timestamp Resource 1 Updated",
			Kind:       "TestKind",
			Config:     map[string]any{"updated": true},
			Metadata:   map[string]string{"env": "production"},
		}

		cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{metadataUpdated})

		r, exists := ws.Resources().GetByIdentifier("ts-res-1")
		require.True(t, exists)
		require.NotNil(t, r.UpdatedAt)
		require.True(t, r.UpdatedAt.After(*previousUpdatedAt),
			"UpdatedAt should change when metadata changes")
	})

	t.Run("different resources get timestamps", func(t *testing.T) {
		beforeCreate := time.Now()

		resources := []*oapi.Resource{
			{
				Identifier: "ts-res-1",
				Name:       "Timestamp Resource 1 Updated",
				Kind:       "TestKind",
				Config:     map[string]any{},
				Metadata:   map[string]string{"env": "production"},
			},
			{
				Identifier: "ts-res-2",
				Name:       "Timestamp Resource 2",
				Kind:       "TestKind",
				Config:     map[string]any{},
				Metadata:   map[string]string{},
			},
		}

		cacheAndSetResources(t, engine, ctx, providerID, resources)

		r1, _ := ws.Resources().GetByIdentifier("ts-res-1")
		r2, exists := ws.Resources().GetByIdentifier("ts-res-2")
		require.True(t, exists)

		// Both should have timestamps for cache key generation
		require.NotNil(t, r1.UpdatedAt, "r1 should have UpdatedAt")
		require.False(t, r2.CreatedAt.IsZero(), "r2 should have CreatedAt")
		require.True(t, r2.CreatedAt.After(beforeCreate) || r2.CreatedAt.Equal(beforeCreate))
	})
}

func TestEngine_Resource_DirectCreate_TimestampsForCache(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()
	ws := engine.Workspace()
	workspaceID := ws.ID

	t.Run("resource created via direct event has CreatedAt", func(t *testing.T) {
		beforeCreate := time.Now()

		resource := c.NewResource(workspaceID)
		resource.Name = "direct-create-resource"
		engine.PushEvent(ctx, handler.ResourceCreate, resource)

		r, exists := ws.Resources().Get(resource.Id)
		require.True(t, exists)
		require.False(t, r.CreatedAt.IsZero(), "CreatedAt should be set")
		require.True(t, r.CreatedAt.After(beforeCreate) || r.CreatedAt.Equal(beforeCreate))
	})
}

func TestEngine_Job_TimestampsForCache(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()
	ws := engine.Workspace()
	workspaceID := ws.ID

	// Setup: Create job agent, system, deployment, environment, resource, and version
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = c.CustomDeploymentJobAgentConfig(map[string]any{"test": "config"})
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	beforeVersionCreate := time.Now()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	t.Run("new job has CreatedAt and UpdatedAt set", func(t *testing.T) {
		pendingJobs := ws.Jobs().GetPending()
		require.Len(t, pendingJobs, 1, "should have 1 pending job")

		var job *oapi.Job
		for _, j := range pendingJobs {
			job = j
			break
		}

		require.False(t, job.CreatedAt.IsZero(), "Job CreatedAt should be set")
		require.True(t, job.CreatedAt.After(beforeVersionCreate) || job.CreatedAt.Equal(beforeVersionCreate),
			"Job CreatedAt should be >= version creation time")
		require.False(t, job.UpdatedAt.IsZero(), "Job UpdatedAt should be set for cache key generation")
	})
}

func TestEngine_Resource_CacheKeyChangesOnUpdate(t *testing.T) {
	providerID := "cache-key-test-provider"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Cache Key Test Provider"),
		),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	// Create initial resource
	resource := &oapi.Resource{
		Identifier: "cache-key-test",
		Name:       "Cache Key Test",
		Kind:       "TestKind",
		Config:     map[string]any{},
		Metadata:   map[string]string{"version": "1"},
	}

	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource})

	r1, _ := ws.Resources().GetByIdentifier("cache-key-test")
	cacheKey1 := generateResourceCacheKey(r1)

	time.Sleep(10 * time.Millisecond)

	// Update the resource
	updatedResource := &oapi.Resource{
		Identifier: "cache-key-test",
		Name:       "Cache Key Test Updated",
		Kind:       "TestKind",
		Config:     map[string]any{},
		Metadata:   map[string]string{"version": "2"},
	}

	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{updatedResource})

	r2, _ := ws.Resources().GetByIdentifier("cache-key-test")
	cacheKey2 := generateResourceCacheKey(r2)

	require.NotEqual(t, cacheKey1, cacheKey2,
		"Cache key should change after resource update (different UpdatedAt)")
	require.Equal(t, r1.Id, r2.Id, "Resource ID should remain the same")
}

// generateResourceCacheKey simulates what the selector cache uses for cache keys
func generateResourceCacheKey(r *oapi.Resource) string {
	if r.UpdatedAt != nil {
		return r.Id + "@" + r.UpdatedAt.Format(time.RFC3339Nano)
	}
	return r.Id + "@" + r.CreatedAt.Format(time.RFC3339Nano)
}
