package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/stretchr/testify/assert"
)

func TestEngine_GithubEntity_Create(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	entity := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 12345,
	}
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity)

	got, ok := engine.Workspace().GithubEntities().Get("my-org", 12345)
	assert.True(t, ok)
	assert.Equal(t, "my-org", got.Slug)
	assert.Equal(t, 12345, got.InstallationId)
}

func TestEngine_GithubEntity_Update(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	entity := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 12345,
	}
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity)

	// Update the entity (same slug + installation id, re-upserted)
	updated := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 12345,
	}
	engine.PushEvent(ctx, handler.GithubEntityUpdate, updated)

	got, ok := engine.Workspace().GithubEntities().Get("my-org", 12345)
	assert.True(t, ok)
	assert.Equal(t, "my-org", got.Slug)
}

func TestEngine_GithubEntity_Delete(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	entity := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 12345,
	}
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity)

	// Verify it exists
	_, ok := engine.Workspace().GithubEntities().Get("my-org", 12345)
	assert.True(t, ok)

	// Delete
	engine.PushEvent(ctx, handler.GithubEntityDelete, entity)

	// Verify removed
	_, ok = engine.Workspace().GithubEntities().Get("my-org", 12345)
	assert.False(t, ok)
}

func TestEngine_GithubEntity_MultipleEntities(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	entity1 := &oapi.GithubEntity{
		Slug:           "org-1",
		InstallationId: 100,
	}
	entity2 := &oapi.GithubEntity{
		Slug:           "org-2",
		InstallationId: 200,
	}
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity1)
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity2)

	items := engine.Workspace().GithubEntities().Items()
	assert.Len(t, items, 2)

	// Delete one
	engine.PushEvent(ctx, handler.GithubEntityDelete, entity1)

	items = engine.Workspace().GithubEntities().Items()
	assert.Len(t, items, 1)

	_, ok := engine.Workspace().GithubEntities().Get("org-2", 200)
	assert.True(t, ok)
}

func TestEngine_GithubEntity_SameSlugDifferentInstallation(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	entity1 := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 100,
	}
	entity2 := &oapi.GithubEntity{
		Slug:           "my-org",
		InstallationId: 200,
	}
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity1)
	engine.PushEvent(ctx, handler.GithubEntityCreate, entity2)

	_, ok1 := engine.Workspace().GithubEntities().Get("my-org", 100)
	_, ok2 := engine.Workspace().GithubEntities().Get("my-org", 200)
	assert.True(t, ok1)
	assert.True(t, ok2)

	// Delete only one installation
	engine.PushEvent(ctx, handler.GithubEntityDelete, entity1)

	_, ok1 = engine.Workspace().GithubEntities().Get("my-org", 100)
	_, ok2 = engine.Workspace().GithubEntities().Get("my-org", 200)
	assert.False(t, ok1)
	assert.True(t, ok2)
}
