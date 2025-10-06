package workspace

import (
	"context"
	"fmt"
	"sync"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
	"workspace-engine/pkg/workspace/store/repository"
)

var _ WorkspaceStore = &DBWorkspaceStore{}

func NewDBWorkspaceStore(ctx context.Context) *DBWorkspaceStore {
	return &DBWorkspaceStore{ctx: ctx}
}

type DBWorkspaceStore struct {
	ctx        context.Context
	workspaces cmap.ConcurrentMap[string, *Workspace]
}

// Load implements WorkspaceStore.
func (d *DBWorkspaceStore) Get(workspaceID string) (*Workspace, error) {
	workspace, ok := d.workspaces.Get(workspaceID)
	if ok {
		return workspace, nil
	}

	initialEntities := &repository.InitialEntities{}

	var wg sync.WaitGroup
	var errs []error

	// Load Resources
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := db.GetResources(d.ctx, workspaceID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to load resources: %w", err))
			return
		}
		initialEntities.Resources = resources
	}()

	// Load Environments
	wg.Add(1)
	go func() {
		defer wg.Done()
		environments, err := db.GetEnvironments(d.ctx, workspaceID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to load environments: %w", err))
			return
		}
		initialEntities.Environments = environments
	}()

	// Load Deployments
	wg.Add(1)
	go func() {
		defer wg.Done()
		deployments, err := db.GetDeployments(d.ctx, workspaceID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to load deployments: %w", err))
			return
		}
		initialEntities.Deployments = deployments
	}()

	// Load Deployment Versions
	wg.Add(1)
	go func() {
		defer wg.Done()
		deploymentVersions, err := db.GetDeploymentVersions(d.ctx, workspaceID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to load deployment versions: %w", err))
			return
		}
		initialEntities.DeploymentVersions = deploymentVersions
	}()

	// Load Deployment Variables
	wg.Add(1)
	go func() {
		defer wg.Done()
		deploymentVariables, err := db.GetDeploymentVariables(d.ctx, workspaceID)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to load deployment variables: %w", err))
			return
		}
		initialEntities.DeploymentVariables = deploymentVariables
	}()

	// Wait for all goroutines to complete
	wg.Wait()

	// Check if any errors occurred
	if len(errs) > 0 {
		return nil, fmt.Errorf("failed to load workspace data: %v", errs)
	}

	repository := repository.Load(initialEntities)
	store := store.NewWithRepository(repository)
	newWs := &Workspace{
		ID:             workspaceID,
		store:          store,
		releasemanager: releasemanager.New(store),
	}

	d.workspaces.Set(workspaceID, newWs)

	return newWs, nil
}

// Write implements WorkspaceStore.
func (d *DBWorkspaceStore) Set(workspaceID string) error {
	panic("unimplemented")
}
