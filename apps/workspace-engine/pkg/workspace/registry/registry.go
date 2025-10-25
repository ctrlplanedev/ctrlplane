package registry

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
)

type Registry struct {
	persistence *persistence.Manager
	workspaces  cmap.ConcurrentMap[string, *workspace.Workspace]
}

type RegistryOption func(*Registry)

func WithPersistence(pm *persistence.Manager) RegistryOption {
	return func(r *Registry) {
		r.persistence = pm
	}
}

func NewRegistry(options ...RegistryOption) *Registry {
	memoryStore := memory.NewStore()
	memoryRegistry := persistence.NewApplyRegistry()
	pm := persistence.NewManager(memoryStore, memoryRegistry)

	reg := &Registry{
		persistence: pm,
		workspaces:  cmap.New[*workspace.Workspace](),
	}

	for _, option := range options {
		option(reg)
	}

	return reg
}

func (r *Registry) Get(id string) (*workspace.Workspace, bool) {
	return r.workspaces.Get(id)
}

func (r *Registry) Set(id string, workspace *workspace.Workspace) {
	r.workspaces.Set(id, workspace)
}

func (r *Registry) Has(id string) bool {
	return r.workspaces.Has(id)
}

func (r *Registry) Keys() []string {
	return r.workspaces.Keys()
}

func (r *Registry) GetOrCreate(ctx context.Context, id string, workspaceOptions ...workspace.WorkspaceOption) (*workspace.Workspace, error) {
	ws, ok := r.Get(id)
	if !ok {
		ws = workspace.New(id, workspaceOptions...)
		r.Set(id, ws)
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
