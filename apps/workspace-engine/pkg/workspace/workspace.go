package workspace

import (
	"encoding/gob"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

var _ gob.GobEncoder = (*Workspace)(nil)
var _ gob.GobDecoder = (*Workspace)(nil)

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

func (w *Workspace) Policies() *store.Policies {
	return w.store.Policies
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

func (w *Workspace) Jobs() *store.Jobs {
	return w.store.Jobs
}

func (w *Workspace) JobAgents() *store.JobAgents {
	return w.store.JobAgents
}

func (w *Workspace) Releases() *store.Releases {
	return w.store.Releases
}

func (w *Workspace) GobEncode() ([]byte, error) {
	return w.store.GobEncode()
}

func (w *Workspace) GobDecode(data []byte) error {
	// Initialize store if needed
	if w.store == nil {
		w.store = &store.Store{}
	}

	// Decode the store
	if err := w.store.GobDecode(data); err != nil {
		return err
	}

	// Reinitialize release manager with the decoded store
	w.releasemanager = releasemanager.New(w.store)

	return nil
}

func (w *Workspace) UserApprovalRecords() *store.UserApprovalRecords {
	return w.store.UserApprovalRecords
}

var workspaces = cmap.New[*Workspace]()

func Exists(id string) bool {
	_, ok := workspaces.Get(id)
	return ok
}

func Set(id string, workspace *Workspace) {
	workspaces.Set(id, workspace)
}

func GetWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = New(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}
