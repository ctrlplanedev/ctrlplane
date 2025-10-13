package handler

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"
)

func loadWorkspaceWithInitialState(ctx context.Context, ws *workspace.Workspace) error {
	initialWorkspaceState, err := db.LoadWorkspace(ctx, ws.ID)
	if err != nil {
		return err
	}

	for _, system := range initialWorkspaceState.Systems() {
		ws.Store().Systems.Upsert(ctx, system)
	}
	for _, resource := range initialWorkspaceState.Resources() {
		ws.Store().Resources.Upsert(ctx, resource)
	}
	for _, deployment := range initialWorkspaceState.Deployments() {
		ws.Store().Deployments.Upsert(ctx, deployment)
	}
	for _, deploymentVersion := range initialWorkspaceState.DeploymentVersions() {
		ws.Store().DeploymentVersions.Upsert(ctx, deploymentVersion.Id, deploymentVersion)
	}
	for _, deploymentVariable := range initialWorkspaceState.DeploymentVariables() {
		ws.Store().DeploymentVariables.Upsert(ctx, deploymentVariable.Id, deploymentVariable)
	}
	for _, environment := range initialWorkspaceState.Environments() {
		ws.Store().Environments.Upsert(ctx, environment)
	}
	for _, policy := range initialWorkspaceState.Policies() {
		ws.Store().Policies.Upsert(ctx, policy)
	}
	for _, jobAgent := range initialWorkspaceState.JobAgents() {
		ws.Store().JobAgents.Upsert(ctx, jobAgent)
	}
	for _, relationship := range initialWorkspaceState.Relationships() {
		ws.Store().Relationships.Upsert(ctx, relationship)
	}

	return nil
}
