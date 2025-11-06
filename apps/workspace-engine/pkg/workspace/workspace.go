package workspace

import (
	"context"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

func New(ctx context.Context, id string, options ...WorkspaceOption) *Workspace {
	cs := statechange.NewChangeSet[any]()
	s := store.New(id, cs)
	rm := releasemanager.New(s)
	ws := &Workspace{
		ID:             id,
		store:          s,
		releasemanager: rm,
		changeset:      cs,
	}

	for _, option := range options {
		option(ws)
	}

	return ws
}

type Workspace struct {
	ID string

	changeset      *statechange.ChangeSet[any]
	store          *store.Store
	releasemanager *releasemanager.Manager
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

func (w *Workspace) Changeset() *statechange.ChangeSet[any] {
	return w.changeset
}

func (w *Workspace) DeploymentVariableValues() *store.DeploymentVariableValues {
	return w.store.DeploymentVariableValues
}

func (w *Workspace) Relations() *store.Relations {
	return w.store.Relations
}
