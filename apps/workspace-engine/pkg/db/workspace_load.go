package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
)

func loadSystems(ctx context.Context, ws *workspace.Workspace) error {
	dbSystems, err := getSystems(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get systems: %w", err)
	}
	for _, system := range dbSystems {
		ws.Systems().Upsert(ctx, system)
	}
	log.Info("Loaded systems", "count", len(dbSystems))
	return nil
}

func loadResources(ctx context.Context, ws *workspace.Workspace) error {
	dbResources, err := getResources(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get resources: %w", err)
	}
	for _, resource := range dbResources {
		ws.Resources().Upsert(ctx, resource)
	}
	log.Info("Loaded resources", "count", len(dbResources))
	return nil
}

func loadDeployments(ctx context.Context, ws *workspace.Workspace) error {
	dbDeployments, err := getDeployments(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}
	for _, deployment := range dbDeployments {
		ws.Deployments().Upsert(ctx, deployment)
	}
	log.Info("Loaded deployments", "count", len(dbDeployments))
	return nil
}

func loadDeploymentVersions(ctx context.Context, ws *workspace.Workspace) error {
	dbDeploymentVersions, err := getDeploymentVersions(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployment versions: %w", err)
	}
	for _, deploymentVersion := range dbDeploymentVersions {
		ws.DeploymentVersions().Upsert(deploymentVersion.DeploymentId, deploymentVersion)
	}
	log.Info("Loaded deployment versions", "count", len(dbDeploymentVersions))
	return nil
}

func loadDeploymentVariables(ctx context.Context, ws *workspace.Workspace) error {
	dbDeploymentVariables, err := getDeploymentVariables(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployment variables: %w", err)
	}
	for _, deploymentVariable := range dbDeploymentVariables {
		ws.Deployments().Variables(deploymentVariable.DeploymentId)[deploymentVariable.Key] = deploymentVariable
	}
	log.Info("Loaded deployment variables", "count", len(dbDeploymentVariables))
	return nil
}

func loadEnvironments(ctx context.Context, ws *workspace.Workspace) error {
	dbEnvironments, err := getEnvironments(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get environments: %w", err)
	}
	for _, environment := range dbEnvironments {
		ws.Environments().Upsert(ctx, environment)
	}
	log.Info("Loaded environments", "count", len(dbEnvironments))
	return nil
}

func loadPolicies(ctx context.Context, ws *workspace.Workspace) error {
	dbPolicies, err := getPolicies(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get policies: %w", err)
	}
	for _, policy := range dbPolicies {
		ws.Policies().Upsert(ctx, policy)
	}
	log.Info("Loaded policies", "count", len(dbPolicies), "policies", dbPolicies)
	return nil
}

func LoadWorkspace(ctx context.Context, workspaceID string) (*workspace.Workspace, error) {
	log.Info("Loading workspace", "workspaceID", workspaceID)
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	ws := workspace.New(workspaceID)

	if err := loadSystems(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load systems: %w", err)
	}

	if err := loadResources(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load resources: %w", err)
	}

	if err := loadDeployments(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load deployments: %w", err)
	}

	if err := loadDeploymentVersions(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load deployment versions: %w", err)
	}

	if err := loadDeploymentVariables(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load deployment variables: %w", err)
	}

	if err := loadEnvironments(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load environments: %w", err)
	}

	if err := loadPolicies(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load policies: %w", err)
	}

	return ws, nil
}
