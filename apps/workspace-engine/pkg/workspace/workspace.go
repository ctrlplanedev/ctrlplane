package workspace

import (
	"bytes"
	"encoding/gob"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

var _ gob.GobEncoder = (*Workspace)(nil)
var _ gob.GobDecoder = (*Workspace)(nil)

func New(id string) *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	cc := db.NewChangesetConsumer(id, s)
	ws := &Workspace{
		ID:                id,
		store:             s,
		releasemanager:    rm,
		changesetConsumer: cc,
	}

	return ws
}

func NewNoFlush(id string) *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	cc := changeset.NewNoopChangesetConsumer()
	ws := &Workspace{
		ID:                id,
		store:             s,
		releasemanager:    rm,
		changesetConsumer: cc,
	}
	return ws
}

type Workspace struct {
	ID string

	store             *store.Store
	releasemanager    *releasemanager.Manager
	changesetConsumer changeset.ChangesetConsumer[any]
}

func (w *Workspace) Store() *store.Store {
	return w.store
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

func (w *Workspace) GithubEntities() *store.GithubEntities {
	return w.store.GithubEntities
}

func (w *Workspace) UserApprovalRecords() *store.UserApprovalRecords {
	return w.store.UserApprovalRecords
}

func (w *Workspace) GobEncode() ([]byte, error) {
	// Encode the store
	storeData, err := w.store.GobEncode()
	if err != nil {
		return nil, err
	}

	// Create workspace data with ID and store
	data := WorkspaceStorageObject{
		ID:        w.ID,
		StoreData: storeData,
	}

	// Encode the workspace data
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	if err := enc.Encode(data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (w *Workspace) GobDecode(data []byte) error {
	// Decode the workspace data
	var wsData WorkspaceStorageObject

	buf := bytes.NewReader(data)
	dec := gob.NewDecoder(buf)
	if err := dec.Decode(&wsData); err != nil {
		return err
	}

	// Restore the workspace ID
	w.ID = wsData.ID

	// Initialize store if needed
	if w.store == nil {
		w.store = &store.Store{}
	}

	// Decode the store
	if err := w.store.GobDecode(wsData.StoreData); err != nil {
		return err
	}

	// Reinitialize release manager with the decoded store
	w.releasemanager = releasemanager.New(w.store)

	return nil
}

func (w *Workspace) RelationshipRules() *store.RelationshipRules {
	return w.store.Relationships
}

func (w *Workspace) ResourceVariables() *store.ResourceVariables {
	return w.store.ResourceVariables
}

func (w *Workspace) Variables() *store.Variables {
	return w.store.Variables
}

func (w *Workspace) DeploymentVariables() *store.DeploymentVariables {
	return w.store.DeploymentVariables
}

func (w *Workspace) ResourceProviders() *store.ResourceProviders {
	return w.store.ResourceProviders
}

func (w *Workspace) ChangesetConsumer() changeset.ChangesetConsumer[any] {
	return w.changesetConsumer
}

var workspaces = cmap.New[*Workspace]()

func Exists(id string) bool {
	_, ok := workspaces.Get(id)
	return ok
}

func Set(id string, workspace *Workspace) {
	workspaces.Set(id, workspace)
}

func HasWorkspace(id string) bool {
	return workspaces.Has(id)
}

func GetWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = New(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}

func GetNoFlushWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = NewNoFlush(id)
		workspaces.Set(id, workspace)
	}
	return workspace
}

func GetAllWorkspaceIds() []string {
	return workspaces.Keys()
}
