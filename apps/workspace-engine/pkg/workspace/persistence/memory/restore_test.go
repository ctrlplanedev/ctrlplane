package memory_test

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/workspace/persistence"
	"workspace-engine/pkg/workspace/persistence/memory"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type Environment struct {
	ID   string
	Name string
}

func (e *Environment) ChangelogKey() (string, string) {
	return "environment", e.ID
}

// Test entities for restore tests
type Deployment struct {
	ID      string
	Name    string
	Version int
}

func (d *Deployment) ChangelogKey() (string, string) {
	return "deployment", d.ID
}

// Mock repositories for testing
type MockDeploymentRepo struct {
	Creates []*Deployment
	Updates []*Deployment
	Deletes []*Deployment
}

func (r *MockDeploymentRepo) Create(ctx context.Context, entity any) error {
	d := entity.(*Deployment)
	r.Creates = append(r.Creates, d)
	return nil
}

func (r *MockDeploymentRepo) Update(ctx context.Context, entity any) error {
	d := entity.(*Deployment)
	r.Updates = append(r.Updates, d)
	return nil
}

func (r *MockDeploymentRepo) Delete(ctx context.Context, entity any) error {
	d := entity.(*Deployment)
	r.Deletes = append(r.Deletes, d)
	return nil
}

type MockEnvironmentRepo struct {
	Creates []*Environment
	Updates []*Environment
	Deletes []*Environment
}

func (r *MockEnvironmentRepo) Create(ctx context.Context, entity any) error {
	e := entity.(*Environment)
	r.Creates = append(r.Creates, e)
	return nil
}

func (r *MockEnvironmentRepo) Update(ctx context.Context, entity any) error {
	e := entity.(*Environment)
	r.Updates = append(r.Updates, e)
	return nil
}

func (r *MockEnvironmentRepo) Delete(ctx context.Context, entity any) error {
	e := entity.(*Environment)
	r.Deletes = append(r.Deletes, e)
	return nil
}

func TestRestore_Basic(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Create and persist changes
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "API Server", Version: 1}).
		Update(&Deployment{ID: "d1", Name: "API Server v2", Version: 2}).
		Build()

	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore state
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)

	// Verify repository received correct operations
	assert.Len(t, deployRepo.Creates, 1, "Should have 1 create")
	assert.Len(t, deployRepo.Updates, 1, "Should have 1 update")
	assert.Len(t, deployRepo.Deletes, 0, "Should have 0 deletes")

	// Verify content
	assert.Equal(t, "d1", deployRepo.Creates[0].ID)
	assert.Equal(t, "API Server", deployRepo.Creates[0].Name)
	assert.Equal(t, 1, deployRepo.Creates[0].Version)

	assert.Equal(t, "d1", deployRepo.Updates[0].ID)
	assert.Equal(t, "API Server v2", deployRepo.Updates[0].Name)
	assert.Equal(t, 2, deployRepo.Updates[0].Version)
}

func TestRestore_MultipleEntityTypes(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup with multiple repositories
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}
	envRepo := &MockEnvironmentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		RegisterRepository("environment", envRepo).
		Build()
	require.NoError(t, err)

	// Create mixed changes
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "API"}).
		Create(&Environment{ID: "e1", Name: "Production"}).
		Update(&Deployment{ID: "d1", Name: "API v2"}).
		Create(&Environment{ID: "e2", Name: "Staging"}).
		Build()

	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)

	// Verify deployments
	assert.Len(t, deployRepo.Creates, 1)
	assert.Len(t, deployRepo.Updates, 1)
	assert.Equal(t, "API", deployRepo.Creates[0].Name)
	assert.Equal(t, "API v2", deployRepo.Updates[0].Name)

	// Verify environments
	assert.Len(t, envRepo.Creates, 2)
	assert.Equal(t, "Production", envRepo.Creates[0].Name)
	assert.Equal(t, "Staging", envRepo.Creates[1].Name)
}

func TestRestore_WithDeletes(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Create changes including delete
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "Service 1"}).
		Create(&Deployment{ID: "d2", Name: "Service 2"}).
		Delete(&Deployment{ID: "d1", Name: "Service 1"}).
		Build()

	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)

	// Verify operations
	assert.Len(t, deployRepo.Creates, 2)
	assert.Len(t, deployRepo.Deletes, 1)
	assert.Equal(t, "d1", deployRepo.Deletes[0].ID)
}

func TestRestore_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Restore empty workspace
	err = manager.Restore(ctx, "non-existent-workspace")
	require.NoError(t, err)

	// Verify no operations
	assert.Empty(t, deployRepo.Creates)
	assert.Empty(t, deployRepo.Updates)
	assert.Empty(t, deployRepo.Deletes)
}

func TestRestore_MissingRepository(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup without registering repository for Environment
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Create changes including unregistered entity type
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "API"}).
		Create(&Environment{ID: "e1", Name: "Production"}).
		Build()

	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore should fail
	err = manager.Restore(ctx, workspaceID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no repository registered")
}

func TestRestore_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Persist to workspace 1
	changes1 := persistence.NewChangelogBuilder("workspace-1").
		Create(&Deployment{ID: "d1", Name: "WS1 Deploy"}).
		Build()
	err = manager.Persist(ctx, changes1)
	require.NoError(t, err)

	// Persist to workspace 2
	changes2 := persistence.NewChangelogBuilder("workspace-2").
		Create(&Deployment{ID: "d2", Name: "WS2 Deploy"}).
		Create(&Deployment{ID: "d3", Name: "WS2 Deploy 2"}).
		Build()
	err = manager.Persist(ctx, changes2)
	require.NoError(t, err)

	// Restore workspace 1
	deployRepo.Creates = nil // Clear
	err = manager.Restore(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, deployRepo.Creates, 1)
	assert.Equal(t, "WS1 Deploy", deployRepo.Creates[0].Name)

	// Restore workspace 2
	deployRepo.Creates = nil // Clear
	err = manager.Restore(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, deployRepo.Creates, 2)
	assert.Equal(t, "WS2 Deploy", deployRepo.Creates[0].Name)
	assert.Equal(t, "WS2 Deploy 2", deployRepo.Creates[1].Name)
}

func TestRestore_PreservesOrder(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Create changes with specific order
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "First", Version: 1}).
		Create(&Deployment{ID: "d2", Name: "Second", Version: 2}).
		Create(&Deployment{ID: "d3", Name: "Third", Version: 3}).
		Update(&Deployment{ID: "d1", Name: "First Updated", Version: 4}).
		Delete(&Deployment{ID: "d2", Name: "Second", Version: 2}).
		Build()

	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// Restore
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)

	// Verify order is preserved
	assert.Equal(t, "First", deployRepo.Creates[0].Name)
	assert.Equal(t, "Second", deployRepo.Creates[1].Name)
	assert.Equal(t, "Third", deployRepo.Creates[2].Name)
	assert.Equal(t, "First Updated", deployRepo.Updates[0].Name)
	assert.Equal(t, "Second", deployRepo.Deletes[0].Name)
}

func TestManagerBuilder_RequiresStore(t *testing.T) {
	// Attempt to build without store
	manager, err := persistence.NewManagerBuilder().
		RegisterRepository("deployment", &MockDeploymentRepo{}).
		Build()

	assert.Error(t, err)
	assert.Nil(t, manager)
	assert.Contains(t, err.Error(), "store is required")
}

// Repository that returns errors for testing error handling
type ErrorRepo struct {
	CreateErr error
	UpdateErr error
	DeleteErr error
}

func (r *ErrorRepo) Create(ctx context.Context, entity any) error {
	return r.CreateErr
}

func (r *ErrorRepo) Update(ctx context.Context, entity any) error {
	return r.UpdateErr
}

func (r *ErrorRepo) Delete(ctx context.Context, entity any) error {
	return r.DeleteErr
}

func TestRestore_HandlesRepositoryErrors(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	tests := []struct {
		name      string
		changes   persistence.Changelog
		repo      *ErrorRepo
		expectErr string
	}{
		{
			name: "create error",
			changes: persistence.NewChangelogBuilder(workspaceID).
				Create(&Deployment{ID: "d1", Name: "Test"}).
				Build(),
			repo: &ErrorRepo{
				CreateErr: fmt.Errorf("create failed"),
			},
			expectErr: "failed to apply change",
		},
		{
			name: "update error",
			changes: persistence.NewChangelogBuilder(workspaceID).
				Update(&Deployment{ID: "d1", Name: "Test"}).
				Build(),
			repo: &ErrorRepo{
				UpdateErr: fmt.Errorf("update failed"),
			},
			expectErr: "failed to apply change",
		},
		{
			name: "delete error",
			changes: persistence.NewChangelogBuilder(workspaceID).
				Delete(&Deployment{ID: "d1", Name: "Test"}).
				Build(),
			repo: &ErrorRepo{
				DeleteErr: fmt.Errorf("delete failed"),
			},
			expectErr: "failed to apply change",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := memory.NewStore()
			manager, err := persistence.NewManagerBuilder().
				WithStore(store).
				RegisterRepository("deployment", tt.repo).
				Build()
			require.NoError(t, err)

			err = manager.Persist(ctx, tt.changes)
			require.NoError(t, err)

			err = manager.Restore(ctx, workspaceID)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectErr)
		})
	}
}

func TestRestore_CompleteIntegration(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}
	envRepo := &MockEnvironmentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		RegisterRepository("environment", envRepo).
		Build()
	require.NoError(t, err)

	// Simulate a series of operations over time
	
	// Day 1: Initial setup
	day1Changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Environment{ID: "prod", Name: "Production"}).
		Create(&Deployment{ID: "api", Name: "API v1"}).
		Build()
	err = manager.Persist(ctx, day1Changes)
	require.NoError(t, err)

	// Day 2: Updates and additions
	day2Changes := persistence.NewChangelogBuilder(workspaceID).
		Update(&Deployment{ID: "api", Name: "API v2"}).
		Create(&Deployment{ID: "worker", Name: "Worker v1"}).
		Build()
	err = manager.Persist(ctx, day2Changes)
	require.NoError(t, err)

	// Day 3: Cleanup
	day3Changes := persistence.NewChangelogBuilder(workspaceID).
		Delete(&Deployment{ID: "worker", Name: "Worker v1"}).
		Create(&Environment{ID: "staging", Name: "Staging"}).
		Build()
	err = manager.Persist(ctx, day3Changes)
	require.NoError(t, err)

	// Restore and verify complete state
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)

	// Verify final state
	assert.Len(t, envRepo.Creates, 2, "Should have 2 environments")
	assert.Len(t, deployRepo.Creates, 2, "Should have 2 deployments created")
	assert.Len(t, deployRepo.Updates, 1, "Should have 1 deployment updated")
	assert.Len(t, deployRepo.Deletes, 1, "Should have 1 deployment deleted")

	// Verify environment names
	envNames := []string{envRepo.Creates[0].Name, envRepo.Creates[1].Name}
	assert.Contains(t, envNames, "Production")
	assert.Contains(t, envNames, "Staging")

	// Verify API was updated
	assert.Equal(t, "API v2", deployRepo.Updates[0].Name)

	// Verify worker was deleted
	assert.Equal(t, "worker", deployRepo.Deletes[0].ID)
}

func TestRestore_MultipleRestores(t *testing.T) {
	ctx := context.Background()
	workspaceID := "workspace-123"

	// Setup
	store := memory.NewStore()
	deployRepo := &MockDeploymentRepo{}

	manager, err := persistence.NewManagerBuilder().
		WithStore(store).
		RegisterRepository("deployment", deployRepo).
		Build()
	require.NoError(t, err)

	// Persist changes
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&Deployment{ID: "d1", Name: "Deploy 1"}).
		Update(&Deployment{ID: "d1", Name: "Deploy 1 Updated"}).
		Build()
	err = manager.Persist(ctx, changes)
	require.NoError(t, err)

	// First restore
	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)
	assert.Len(t, deployRepo.Creates, 1)
	assert.Len(t, deployRepo.Updates, 1)

	// Clear and restore again - should produce same result
	deployRepo.Creates = nil
	deployRepo.Updates = nil
	deployRepo.Deletes = nil

	err = manager.Restore(ctx, workspaceID)
	require.NoError(t, err)
	assert.Len(t, deployRepo.Creates, 1)
	assert.Len(t, deployRepo.Updates, 1)
}

