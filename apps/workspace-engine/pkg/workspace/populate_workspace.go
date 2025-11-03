package workspace

import (
	"context"
	"workspace-engine/pkg/db"
)

func PopulateWorkspaceWithInitialState(ctx context.Context, ws *Workspace) error {
	initialWorkspaceState, err := db.LoadWorkspace(ctx, ws.ID)
	if err != nil {
		return err
	}

	for _, system := range initialWorkspaceState.Systems() {
		if err := ws.Systems().Upsert(ctx, system); err != nil {
			return err
		}
	}
	for _, resource := range initialWorkspaceState.Resources() {
		if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
			return err
		}
	}
	for _, resourceProvider := range initialWorkspaceState.ResourceProviders() {
		ws.store.ResourceProviders.Upsert(ctx, resourceProvider.Id, resourceProvider)
	}
	for _, deployment := range initialWorkspaceState.Deployments() {
		if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
			return err
		}
	}
	for _, deploymentVersion := range initialWorkspaceState.DeploymentVersions() {
		ws.DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)
	}

	for _, deploymentVariable := range initialWorkspaceState.DeploymentVariables() {
		ws.DeploymentVariables().Upsert(ctx, deploymentVariable.Id, deploymentVariable)
	}

	for _, environment := range initialWorkspaceState.Environments() {
		if err := ws.Environments().Upsert(ctx, environment); err != nil {
			return err
		}
	}
	for _, policy := range initialWorkspaceState.Policies() {
		ws.Policies().Upsert(ctx, policy)
	}
	for _, release := range initialWorkspaceState.Releases() {
		if err := ws.Releases().Upsert(ctx, release); err != nil {
			return err
		}
	}
	for _, job := range initialWorkspaceState.Jobs() {
		for _, initialRelease := range initialWorkspaceState.Releases() {
			if initialRelease.UUID().String() == job.ReleaseId {
				job.ReleaseId = initialRelease.ID()
				break
			}
		}

		ws.Jobs().Upsert(ctx, job)
	}
	for _, jobAgent := range initialWorkspaceState.JobAgents() {
		ws.JobAgents().Upsert(ctx, jobAgent)
	}
	for _, relationship := range initialWorkspaceState.Relationships() {
		if err := ws.RelationshipRules().Upsert(ctx, relationship); err != nil {
			return err
		}
	}
	for _, githubEntity := range initialWorkspaceState.GithubEntities() {
		ws.GithubEntities().Upsert(ctx, githubEntity)
	}
	for _, userApprovalRecord := range initialWorkspaceState.UserApprovalRecords() {
		ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)
	}

	return nil
}
