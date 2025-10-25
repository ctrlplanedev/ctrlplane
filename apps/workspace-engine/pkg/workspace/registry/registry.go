package registry

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
)

type Registry struct {
	persistence            *persistence.Manager
	workspaces             cmap.ConcurrentMap[string, *workspace.Workspace]
	workspaceCreateOptions []workspace.WorkspaceOption
}

type RegistryOption func(*Registry)

func WithPersistence(store persistence.Store) RegistryOption {
	return func(r *Registry) {
		registry := r.persistence.ApplyRegistry()
		r.persistence = persistence.NewManager(store, registry)
	}
}

func WithApplyRegistry(registry *persistence.ApplyRegistry) RegistryOption {
	return func(r *Registry) {
		store := r.persistence.Store()
		r.persistence = persistence.NewManager(store, registry)
	}
}

func WithWorkspaceCreateOptions(options ...workspace.WorkspaceOption) RegistryOption {
	return func(r *Registry) {
		r.workspaceCreateOptions = options
	}
}

func NewRegistry(options ...RegistryOption) *Registry {
	memoryStore := memory.NewStore()
	memoryRegistry := persistence.NewApplyRegistry()
	pm := persistence.NewManager(memoryStore, memoryRegistry)

	reg := &Registry{
		persistence:            pm,
		workspaces:             cmap.New[*workspace.Workspace](),
		workspaceCreateOptions: []workspace.WorkspaceOption{},
	}

	for _, option := range options {
		option(reg)
	}

	return reg
}

func (r *Registry) get(id string) (*workspace.Workspace, bool) {
	return r.workspaces.Get(id)
}

func (r *Registry) set(id string, workspace *workspace.Workspace) {
	r.workspaces.Set(id, workspace)
}

func (r *Registry) Keys() []string {
	return r.workspaces.Keys()
}

func (r *Registry) GetOrLoad(ctx context.Context, id string, workspaceOptions ...workspace.WorkspaceOption) (*workspace.Workspace, error) {
	ws, ok := r.get(id)
	if !ok {
		ws = workspace.Load(ctx, id, workspaceOptions...)
		r.set(id, ws)
	}
	return ws, nil
}

var Workspaces = NewRegistry()

func SetRegistry(registry *Registry) {
	if len(Workspaces.Keys()) > 0 {
		panic("registry has workspaces, cannot set registry")
	}

	Workspaces = registry
}
