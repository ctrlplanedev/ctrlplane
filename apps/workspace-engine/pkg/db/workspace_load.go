package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
)

func LoadWorkspace(ctx context.Context, workspaceID string) (*workspace.Workspace, error) {
	log.Info("Loading workspace", "workspaceID", workspaceID)
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	ws := workspace.New(workspaceID)

	dbResources, err := GetResources(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resources: %w", err)
	}
	for _, resource := range dbResources {
		ws.Resources().Upsert(ctx, resource)
	}
	log.Info("Loaded resources", "count", len(dbResources))

	dbDeployments, err := GetDeployments(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployments: %w", err)
	}
	for _, deployment := range dbDeployments {
		ws.Deployments().Upsert(ctx, deployment)
	}
	log.Info("Loaded deployments", "count", len(dbDeployments))

	dbDeploymentVersions, err := GetDeploymentVersions(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment versions: %w", err)
	}
	for _, deploymentVersion := range dbDeploymentVersions {
		ws.DeploymentVersions().Upsert(deploymentVersion.DeploymentId, deploymentVersion)
	}
	log.Info("Loaded deployment versions", "count", len(dbDeploymentVersions))

	dbDeploymentVariables, err := GetDeploymentVariables(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment variables: %w", err)
	}
	for _, deploymentVariable := range dbDeploymentVariables {
		ws.Deployments().Variables(deploymentVariable.DeploymentId)[deploymentVariable.Key] = deploymentVariable
	}
	log.Info("Loaded deployment variables", "count", len(dbDeploymentVariables))

	dbEnvironments, err := GetEnvironments(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get environments: %w", err)
	}
	for _, environment := range dbEnvironments {
		ws.Environments().Upsert(ctx, environment)
	}
	log.Info("Loaded environments", "count", len(dbEnvironments))

	return ws, nil
}
