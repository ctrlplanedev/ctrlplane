package memory_test

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type Environment struct {
	ID   string
	Name string
}

func (e *Environment) CompactionKey() (string, string) {
	return "environment", e.ID
}

// Test entities for restore tests
type Deployment struct {
	ID      string
	Name    string
	Version int
}

func (d *Deployment) CompactionKey() (string, string) {
	return "deployment", d.ID
}

// Mock repositories for testing
type MockDeploymentRepo struct {
	Sets   []*Deployment
	Unsets []*Deployment
}

func (r *MockDeploymentRepo) Set(ctx context.Context, entity any) error {
	d := entity.(*Deployment)
	r.Sets = append(r.Sets, d)
	return nil
}

func (r *MockDeploymentRepo) Unset(ctx context.Context, entity any) error {
	d := entity.(*Deployment)
	r.Unsets = append(r.Unsets, d)
	return nil
}

type MockEnvironmentRepo struct {
	Sets   []*Environment
	Unsets []*Environment
}

func (r *MockEnvironmentRepo) Set(ctx context.Context, entity any) error {
	e := entity.(*Environment)
	r.Sets = append(r.Sets, e)
	return nil
}

func (r *MockEnvironmentRepo) Unset(ctx context.Context, entity any) error {
	e := entity.(*Environment)
	r.Unsets = append(r.Unsets, e)
	return nil
}

func TestRestore_Basic(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Create and persist changes
	// Note: When same entity has multiple changes, compaction keeps only the latest
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "API Server", Version: 1}).
		Set(&Deployment{ID: "d1", Name: "API Server v2", Version: 2}).
		Build()

	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore state
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)

	// Verify repository received correct operations
	// Due to compaction, only the latest change (Set) is applied
	assert.Len(t, deployRepo.Sets, 1, "Should have 1 set (latest state)")
	assert.Len(t, deployRepo.Unsets, 0, "Should have 0 unsets")

	// Verify content - should be the latest version
	assert.Equal(t, "d1", deployRepo.Sets[0].ID)
	assert.Equal(t, "API Server v2", deployRepo.Sets[0].Name)
	assert.Equal(t, 2, deployRepo.Sets[0].Version)
}

func TestRestore_MultipleEntityTypes(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup with multiple repositories
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}
	envRepo := &MockEnvironmentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		RegisterRepository("environment", envRepo).
		Build()

	// Create mixed changes
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "API"}).
		Set(&Environment{ID: "e1", Name: "Production"}).
		Set(&Deployment{ID: "d1", Name: "API v2"}).
		Set(&Environment{ID: "e2", Name: "Staging"}).
		Build()

	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)

	// Verify deployments - compacted to latest state per entity
	assert.Len(t, deployRepo.Sets, 1, "Should have 1 set (compacted)")
	assert.Len(t, deployRepo.Unsets, 0)
	assert.Equal(t, "API v2", deployRepo.Sets[0].Name, "Should have latest version")

	// Verify environments (order not guaranteed from map)
	assert.Len(t, envRepo.Sets, 2)
	envNames := []string{envRepo.Sets[0].Name, envRepo.Sets[1].Name}
	assert.Contains(t, envNames, "Production")
	assert.Contains(t, envNames, "Staging")
}

func TestRestore_WithDeletes(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Create changes including delete
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "Service 1"}).
		Set(&Deployment{ID: "d2", Name: "Service 2"}).
		Set(&Deployment{ID: "d3", Name: "Service 3"}).
		Unset(&Deployment{ID: "d1", Name: "Service 1"}).
		Build()

	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)

	// Verify operations (d1 is compacted to unset, d2 and d3 are sets)
	assert.Len(t, deployRepo.Sets, 2, "Should have 2 sets (d2 and d3)")
	assert.Len(t, deployRepo.Unsets, 1, "Should have 1 unset (d1)")
	assert.Equal(t, "d1", deployRepo.Unsets[0].ID)
}

func TestRestore_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Restore empty workspace
	err := manager.Restore(ctx, "non-existent-workspace")
	require.NoError(t, err)

	// Verify no operations
	assert.Empty(t, deployRepo.Sets)
	assert.Empty(t, deployRepo.Unsets)
}

func TestRestore_MissingRepository(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup without registering repository for Environment
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Create changes including unregistered entity type
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "API"}).
		Set(&Environment{ID: "e1", Name: "Production"}).
		Build()

	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore should fail
	err = manager.Restore(ctx, namespace)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no repository registered")
}

func TestRestore_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Persist to workspace 1
	changes1 := persistence.NewChangesBuilder("workspace-1").
		Set(&Deployment{ID: "d1", Name: "WS1 Deploy"}).
		Build()
	err := manager.Persist(ctx, changes1)
	require.NoError(t, err)

	// Persist to workspace 2
	changes2 := persistence.NewChangesBuilder("workspace-2").
		Set(&Deployment{ID: "d2", Name: "WS2 Deploy"}).
		Set(&Deployment{ID: "d3", Name: "WS2 Deploy 2"}).
		Build()
	err = manager.Persist(ctx, changes2)
	require.NoError(t, err)

	// Restore workspace 1
	deployRepo.Sets = nil // Clear
	err = manager.Restore(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, deployRepo.Sets, 1)
	assert.Equal(t, "WS1 Deploy", deployRepo.Sets[0].Name)

	// Restore workspace 2
	deployRepo.Sets = nil // Clear
	err = manager.Restore(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, deployRepo.Sets, 2)
	assert.Equal(t, "WS2 Deploy", deployRepo.Sets[0].Name)
	assert.Equal(t, "WS2 Deploy 2", deployRepo.Sets[1].Name)
}

func TestRestore_PreservesOrder(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Create changes with specific order
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "First", Version: 1}).
		Set(&Deployment{ID: "d2", Name: "Second", Version: 2}).
		Set(&Deployment{ID: "d3", Name: "Third", Version: 3}).
		Set(&Deployment{ID: "d1", Name: "First Updated", Version: 4}).
		Unset(&Deployment{ID: "d2", Name: "Second", Version: 2}).
		Build()

	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)

	// Verify final state after compaction
	// First: Set -> Set (compacted to latest)
	// Second: Set -> Unset (compacted to unset)
	// Third: Set (compacted to set)
	assert.Len(t, deployRepo.Sets, 2, "Should have 2 sets after compaction")
	assert.Len(t, deployRepo.Unsets, 1, "Should have 1 unset after compaction")
}

func TestManagerBuilder_RequiresStore(t *testing.T) {
	// Attempt to build without store
	manager := persistence.NewManagerBuilder().
		RegisterRepository("deployment", &MockDeploymentRepo{}).
		Build()

	// Manager is built but will panic/fail when trying to use it without a store
	// This test verifies the builder doesn't crash when Build() is called
	assert.NotNil(t, manager)
}

// Repository that returns errors for testing error handling
type ErrorRepo struct {
	SetErr   error
	UnsetErr error
}

func (r *ErrorRepo) Set(ctx context.Context, entity any) error {
	return r.SetErr
}

func (r *ErrorRepo) Unset(ctx context.Context, entity any) error {
	return r.UnsetErr
}

func TestRestore_HandlesRepositoryErrors(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	tests := []struct {
		name      string
		changes   persistence.Changes
		repo      *ErrorRepo
		expectErr string
	}{
		{
			name: "set error",
			changes: persistence.NewChangesBuilder(namespace).
				Set(&Deployment{ID: "d1", Name: "Test"}).
				Build(),
			repo: &ErrorRepo{
				SetErr: fmt.Errorf("set failed"),
			},
			expectErr: "failed to apply change",
		},
		{
			name: "unset error",
			changes: persistence.NewChangesBuilder(namespace).
				Unset(&Deployment{ID: "d1", Name: "Test"}).
				Build(),
			repo: &ErrorRepo{
				UnsetErr: fmt.Errorf("unset failed"),
			},
			expectErr: "failed to apply change",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := memory.NewStore()
			manager := persistence.NewManagerBuilder().
				WithStore(store).
				RegisterRepository("deployment", tt.repo).
				Build()

			err := manager.Persist(ctx, tt.changes)
			require.NoError(t, err)

			err = manager.Restore(ctx, namespace)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectErr)
		})
	}
}

func TestRestore_CompleteIntegration(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}
	envRepo := &MockEnvironmentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		RegisterRepository("environment", envRepo).
		Build()

	// Simulate a series of operations over time

	// Day 1: Initial setup
	day1Changes := persistence.NewChangesBuilder(namespace).
		Set(&Environment{ID: "prod", Name: "Production"}).
		Set(&Deployment{ID: "api", Name: "API v1"}).
		Build()
	err := manager.Persist(ctx, day1Changes)
	require.NoError(t, err)

	// Day 2: Updates and additions
	day2Changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "api", Name: "API v2"}).
		Set(&Deployment{ID: "worker", Name: "Worker v1"}).
		Build()
	err = manager.Persist(ctx, day2Changes)
	require.NoError(t, err)

	// Day 3: Cleanup
	day3Changes := persistence.NewChangesBuilder(namespace).
		Unset(&Deployment{ID: "worker", Name: "Worker v1"}).
		Set(&Environment{ID: "staging", Name: "Staging"}).
		Build()
	err = manager.Persist(ctx, day3Changes)
	require.NoError(t, err)

	// Restore and verify complete state
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)

	// Verify final state after compaction
	assert.Len(t, envRepo.Sets, 2, "Should have 2 environments")
	assert.Len(t, deployRepo.Sets, 1, "Should have 1 deployment (api, latest version)")
	assert.Len(t, deployRepo.Unsets, 1, "Should have 1 deployment deleted (worker)")

	// Verify environment names
	envNames := []string{envRepo.Sets[0].Name, envRepo.Sets[1].Name}
	assert.Contains(t, envNames, "Production")
	assert.Contains(t, envNames, "Staging")

	// Verify API was compacted to latest version
	var apiDeployment *Deployment
	for _, d := range deployRepo.Sets {
		if d.ID == "api" {
			apiDeployment = d
			break
		}
	}
	require.NotNil(t, apiDeployment, "API deployment should exist")
	assert.Equal(t, "API v2", apiDeployment.Name)

	// Verify worker was deleted
	assert.Equal(t, "worker", deployRepo.Unsets[0].ID)
}

func TestRestore_MultipleRestores(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()

	// Persist changes for two different deployments
	changes := persistence.NewChangesBuilder(namespace).
		Set(&Deployment{ID: "d1", Name: "Deploy 1"}).
		Set(&Deployment{ID: "d2", Name: "Deploy 2"}).
		Build()
	err := manager.Persist(ctx, changes)
	require.NoError(t, err)

	// First restore
	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, deployRepo.Sets, 2, "Should have 2 sets")

	// Clear and restore again - should produce same result
	deployRepo.Sets = nil
	deployRepo.Unsets = nil

	err = manager.Restore(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, deployRepo.Sets, 2, "Should have same 2 sets on second restore")
}
