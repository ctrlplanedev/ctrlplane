package manager

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
)

var globalManager = &manager{
	persistentStore:        memory.NewStore(),
	workspaces:             cmap.New[*workspace.Workspace](),
	workspaceCreateOptions: []workspace.WorkspaceOption{},
}

type manager struct {
	persistentStore        persistence.Store
	workspaces             cmap.ConcurrentMap[string, *workspace.Workspace]
	workspaceCreateOptions []workspace.WorkspaceOption
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

func Configure(options ...ManagerOption) {
	for _, option := range options {
		option(globalManager)
	}
}

func GetOrLoad(ctx context.Context, id string) (*workspace.Workspace, error) {
	ws, ok := globalManager.workspaces.Get(id)
	if !ok {
		ws = workspace.New(ctx, id, globalManager.workspaceCreateOptions...)

		changes, err := globalManager.persistentStore.Load(ctx, id)
		if err != nil {
			return nil, err
		}

		if err := workspace.PopulateWorkspaceWithInitialState(ctx, ws); err != nil {
			return nil, err
		}

		if err := ws.Store().Restore(ctx, changes); err != nil {
			return nil, err
		}

		globalManager.workspaces.Set(id, ws)
	}
	return ws, nil
}

func PersistenceStore() persistence.Store {
	return globalManager.persistentStore
}

func Workspaces() cmap.ConcurrentMap[string, *workspace.Workspace] {
	return globalManager.workspaces
}
