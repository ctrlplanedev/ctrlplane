package workspace

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/releasemanager/action/rollback"
	verificationaction "workspace-engine/pkg/workspace/releasemanager/action/verification"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"
	"workspace-engine/pkg/workspace/workflowmanager"
)

func New(ctx context.Context, id string, options ...WorkspaceOption) *Workspace {
	cs := statechange.NewChangeSet[any]()
	s := store.New(id, cs)

	ws := &Workspace{
		ID:         id,
		store:      s,
		changeset:  cs,
		traceStore: spanstore.NewInMemoryStore(),
	}

	// Apply options first to allow setting traceStore
	for _, option := range options {
		option(ws)
	}

	ws.verificationManager = verification.NewManager(s)
	ws.jobAgentRegistry = jobagents.NewRegistry(ws.store, ws.verificationManager)

	// Create release manager with trace store (will panic if nil)
	ws.releasemanager = releasemanager.New(s, ws.traceStore, ws.verificationManager, ws.jobAgentRegistry)
	ws.workflowManager = workflowmanager.NewWorkflowManager(s, ws.jobAgentRegistry)

	reconcileFn := func(ctx context.Context, targets []*oapi.ReleaseTarget) error {
		return ws.releasemanager.ReconcileTargets(ctx, targets, releasemanager.WithTrigger(trace.TriggerJobSuccess))
	}

	ws.actionOrchestrator = action.
		NewOrchestrator(s).
		RegisterAction(verificationaction.NewVerificationAction(ws.verificationManager)).
		RegisterAction(deploymentdependency.NewDeploymentDependencyAction(s, reconcileFn)).
		RegisterAction(environmentprogression.NewEnvironmentProgressionAction(s, reconcileFn)).
		RegisterAction(rollback.NewRollbackAction(s, ws.jobAgentRegistry))

	ws.workflowActionOrchestrator = workflowmanager.
		NewWorkflowActionOrchestrator(s).
		RegisterAction(workflowmanager.NewWorkflowManagerAction(s, ws.workflowManager))

	return ws
}

type Workspace struct {
	ID string

	changeset                  *statechange.ChangeSet[any]
	store                      *store.Store
	verificationManager        *verification.Manager
	workflowManager            *workflowmanager.Manager
	releasemanager             *releasemanager.Manager
	traceStore                 releasemanager.PersistenceStore
	actionOrchestrator         *action.Orchestrator
	workflowActionOrchestrator *workflowmanager.WorkflowActionOrchestrator
	jobAgentRegistry           *jobagents.Registry
}

func (w *Workspace) ActionOrchestrator() *action.Orchestrator {
	return w.actionOrchestrator
}

func (w *Workspace) WorkflowActionOrchestrator() *workflowmanager.WorkflowActionOrchestrator {
	return w.workflowActionOrchestrator
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

func (w *Workspace) VerificationManager() *verification.Manager {
	return w.verificationManager
}

func (w *Workspace) WorkflowManager() *workflowmanager.Manager {
	return w.workflowManager
}

func (w *Workspace) JobAgentRegistry() *jobagents.Registry {
	return w.jobAgentRegistry
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

func (w *Workspace) WorkflowTemplates() *store.WorkflowTemplates {
	return w.store.WorkflowTemplates
}

func (w *Workspace) WorfklowJobTemplates() *store.WorkflowJobTemplates {
	return w.store.WorkflowJobTemplates
}

func (w *Workspace) Workflows() *store.Workflows {
	return w.store.Workflows
}

func (w *Workspace) WorkflowJobs() *store.WorkflowJobs {
	return w.store.WorkflowJobs
}
