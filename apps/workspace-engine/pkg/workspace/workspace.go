package workspace

import (
	"context"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"
)

func New(ctx context.Context, id string, options ...WorkspaceOption) *Workspace {
	ws := &Workspace{
		ID:         id,
		traceStore: trace.NewInMemoryStore(),
	}

	// Apply options first to allow setting persistenceStore and traceStore
	for _, option := range options {
		option(ws)
	}

	// Create the changeset - either simple or with persistence
	inmem := statechange.NewChangeSet[any]()
	if ws.persistenceStore != nil {
		// Create persisting changeset that auto-saves to the store
		ws.persister = persistence.NewPersistingChangeSet(id, ws.persistenceStore)
		// Union broadcasts to both: inmem for reading, persister for async persistence
		ws.changeset = statechange.NewUnionChangeSet(inmem, ws.persister)
	} else {
		ws.changeset = inmem
	}

	ws.store = store.New(id, ws.changeset)

	// Create release manager with trace store (will panic if nil)
	ws.releasemanager = releasemanager.New(ws.store, ws.traceStore)

	return ws
}

type Workspace struct {
	ID string

	changeset        statechange.ChangeSet[any]
	store            *store.Store
	releasemanager   *releasemanager.Manager
	traceStore       releasemanager.PersistenceStore
	persistenceStore persistence.Store
	persister        *persistence.PersistingChangeSet
}

// Close shuts down the workspace, flushing any pending persistence writes.
func (w *Workspace) Close() {
	if w.persister != nil {
		w.persister.Close()
	}
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

func (w *Workspace) Changeset() statechange.ChangeSet[any] {
	return w.changeset
}

func (w *Workspace) DeploymentVariableValues() *store.DeploymentVariableValues {
	return w.store.DeploymentVariableValues
}

func (w *Workspace) Relations() *store.Relations {
	return w.store.Relations
}
