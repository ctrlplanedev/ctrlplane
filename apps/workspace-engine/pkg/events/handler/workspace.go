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
		if err := ws.Store().Systems.Upsert(ctx, system); err != nil {
			return err
		}
	}
	for _, resource := range initialWorkspaceState.Resources() {
		if _, err := ws.Store().Resources.Upsert(ctx, resource); err != nil {
			return err
		}
	}
	for _, deployment := range initialWorkspaceState.Deployments() {
		if err := ws.Store().Deployments.Upsert(ctx, deployment); err != nil {
			return err
		}
	}
	for _, deploymentVersion := range initialWorkspaceState.DeploymentVersions() {
		ws.Store().DeploymentVersions.Upsert(ctx, deploymentVersion.Id, deploymentVersion)
	}
	for _, deploymentVariable := range initialWorkspaceState.DeploymentVariables() {
		ws.Store().DeploymentVariables.Upsert(ctx, deploymentVariable.Id, deploymentVariable)
	}
	for _, environment := range initialWorkspaceState.Environments() {
		if err := ws.Store().Environments.Upsert(ctx, environment); err != nil {
			return err
		}
	}
	for _, policy := range initialWorkspaceState.Policies() {
		if err := ws.Store().Policies.Upsert(ctx, policy); err != nil {
			return err
		}
	}
	for _, release := range initialWorkspaceState.Releases() {
		if err := ws.Store().Releases.Upsert(ctx, release); err != nil {
			return err
		}
	}
	for _, jobAgent := range initialWorkspaceState.JobAgents() {
		ws.Store().JobAgents.Upsert(ctx, jobAgent)
	}
	for _, relationship := range initialWorkspaceState.Relationships() {
		if err := ws.Store().Relationships.Upsert(ctx, relationship); err != nil {
			return err
		}
	}

	return nil
}
