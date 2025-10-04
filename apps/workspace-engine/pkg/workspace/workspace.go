package workspace

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

func New(id string) *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	ws := &Workspace{
		ID:             id,
		store:          s,
		releasemanager: rm,
	}
	return ws
}

type Workspace struct {
	ID string

	store          *store.Store
	releasemanager *releasemanager.Manager
}

func (w *Workspace) ReleaseManager() *releasemanager.Manager {
	return w.releasemanager
}

func (w *Workspace) DeploymentVersions() *store.DeploymentVersions {
	return w.store.DeploymentVersions
}

func (w *Workspace) Environments() *store.Environments {
	return w.store.Environments
}

func (w *Workspace) Deployments() *store.Deployments {
	return w.store.Deployments
}

func (w *Workspace) Resources() *store.Resources {
	return w.store.Resources
}

func (w *Workspace) ReleaseTargets() *store.ReleaseTargets {
	return w.store.ReleaseTargets
}

func (w *Workspace) Systems() *store.Systems {
	return w.store.Systems
}

var workspaces = cmap.New[*Workspace]()

func GetWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = New(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}
