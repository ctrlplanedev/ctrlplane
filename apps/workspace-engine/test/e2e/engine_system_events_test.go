package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_SystemUpdated tests that HandleSystemUpdated correctly upserts a system.
func TestEngine_SystemUpdated(t *testing.T) {
	systemID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("original-system"),
			integration.SystemDescription("original description"),
		),
	)

	ctx := context.Background()

	// Verify initial state
	system, ok := engine.Workspace().Systems().Get(systemID)
	assert.True(t, ok)
	assert.Equal(t, "original-system", system.Name)

	// Update via event
	updated := &oapi.System{
		Id:          systemID,
		Name:        "updated-system",
		Description: strPtr("updated description"),
	}
	engine.PushEvent(ctx, handler.SystemUpdate, updated)

	// Verify update
	system, ok = engine.Workspace().Systems().Get(systemID)
	assert.True(t, ok)
	assert.Equal(t, "updated-system", system.Name)
}

// TestEngine_SystemCreate tests creating a system via event.
func TestEngine_SystemCreate(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	systemID := uuid.New().String()
	system := &oapi.System{
		Id:   systemID,
		Name: "new-system",
	}
	engine.PushEvent(ctx, handler.SystemCreate, system)

	got, ok := engine.Workspace().Systems().Get(systemID)
	assert.True(t, ok)
	assert.Equal(t, "new-system", got.Name)
}

// TestEngine_SystemDelete tests deleting a system via event.
func TestEngine_SystemDelete(t *testing.T) {
	systemID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("to-delete"),
		),
	)
	ctx := context.Background()

	system, ok := engine.Workspace().Systems().Get(systemID)
	assert.True(t, ok)

	engine.PushEvent(ctx, handler.SystemDelete, system)

	_, ok = engine.Workspace().Systems().Get(systemID)
	assert.False(t, ok)
}

func strPtr(s string) *string {
	return &s
}
