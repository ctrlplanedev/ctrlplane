package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/workspace"

	"golang.org/x/sync/errgroup"
)

func LoadWorkspace(ctx context.Context, workspaceID string) (*workspace.Workspace, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	g, ctx := errgroup.WithContext(ctx)

	ws := workspace.New(workspaceID)

	g.Go(func() error {
		dbResources, err := GetResources(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to get resources: %w", err)
		}

		for _, resource := range dbResources {
			ws.Resources().Upsert(ctx, resource)
		}
		return nil
	})

	g.Go(func() error {
		dbDeployments, err := GetDeployments(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to get deployments: %w", err)
		}
		for _, deployment := range dbDeployments {
			ws.Deployments().Upsert(ctx, deployment)
		}
		return nil
	})

	g.Go(func() error {
		dbDeploymentVersions, err := GetDeploymentVersions(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to get deployment versions: %w", err)
		}

		for _, deploymentVersion := range dbDeploymentVersions {
			ws.DeploymentVersions().Upsert(deploymentVersion.DeploymentId, deploymentVersion)
		}
		return nil
	})

	g.Go(func() error {
		dbDeploymentVariables, err := GetDeploymentVariables(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to get deployment variables: %w", err)
		}

		for _, deploymentVariable := range dbDeploymentVariables {
			ws.Deployments().Variables(deploymentVariable.DeploymentId)[deploymentVariable.Key] = deploymentVariable
		}
		return nil
	})

	g.Go(func() error {
		dbEnvironments, err := GetEnvironments(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to get environments: %w", err)
		}
		for _, environment := range dbEnvironments {
			ws.Environments().Upsert(ctx, environment)
		}
		return nil
	})

	// Wait for all goroutines to complete
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to load workspace: %w", err)
	}

	return ws, nil
}
