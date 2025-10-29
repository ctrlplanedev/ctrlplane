package manager

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/status"
)

var globalManager = &manager{
	persistentStore:        memory.NewStore(),
	workspaces:             cmap.New[*workspace.Workspace](),
	workspaceCreateOptions: []workspace.WorkspaceOption{},
}

type manager struct {
	persistentStore            persistence.Store
	workspaces                 cmap.ConcurrentMap[string, *workspace.Workspace]
	workspaceCreateOptions     []workspace.WorkspaceOption
	skipInitialStatePopulation bool
}

type ManagerOption func(*manager)

func WithPersistentStore(store persistence.Store) ManagerOption {
	return func(c *manager) {
		c.persistentStore = store
	}
}

func WithWorkspaceCreateOptions(options ...workspace.WorkspaceOption) ManagerOption {
	return func(c *manager) {
		c.workspaceCreateOptions = options
	}
}

// WithSkipInitialStatePopulation skips the database population step when loading workspaces.
// Useful for testing scenarios where you want to control workspace state explicitly.
func WithSkipInitialStatePopulation() ManagerOption {
	return func(c *manager) {
		c.skipInitialStatePopulation = true
	}
}

func Configure(options ...ManagerOption) {
	for _, option := range options {
		option(globalManager)
	}
}

func GetOrLoad(ctx context.Context, id string) (*workspace.Workspace, error) {
	ws, ok := globalManager.workspaces.Get(id)
	if !ok {
		// Track workspace loading status
		workspaceStatus := status.Global().GetOrCreate(id)
		workspaceStatus.SetState(status.StateInitializing, "Creating workspace instance")

		ws = workspace.New(ctx, id, globalManager.workspaceCreateOptions...)

		// Load from persistence
		workspaceStatus.SetState(status.StateLoadingFromPersistence, "Loading workspace from persistent store")
		changes, err := globalManager.persistentStore.Load(ctx, id)
		if err != nil {
			workspaceStatus.SetError(err)
			return nil, err
		}
		workspaceStatus.UpdateMetadata("changes_loaded", len(changes))

		// Populate initial state (unless skipped)
		// if !globalManager.skipInitialStatePopulation {
		// 	workspaceStatus.SetState(status.StatePopulatingInitialState, "Populating workspace with initial state")
		// 	if err := workspace.PopulateWorkspaceWithInitialState(ctx, ws); err != nil {
		// 		workspaceStatus.SetError(err)
		// 		return nil, err
		// 	}
		// 	ws.Changeset().Clear()
		// }

		// Restore from snapshot
		workspaceStatus.SetState(status.StateRestoringFromSnapshot, "Restoring workspace from snapshot")
		if err := ws.Store().Restore(ctx, changes); err != nil {
			workspaceStatus.SetError(err)
			return nil, err
		}

		for id, resource := range ws.Resources().Items() {
			if resource.Id != id {
				ws.Resources().Remove(ctx, id)
			}
		}

		globalManager.workspaces.Set(id, ws)

		// Mark as ready
		workspaceStatus.SetState(status.StateReady, "Workspace loaded and ready")
	}
	return ws, nil
}

func PersistenceStore() persistence.Store {
	return globalManager.persistentStore
}

func Workspaces() cmap.ConcurrentMap[string, *workspace.Workspace] {
	return globalManager.workspaces
}
