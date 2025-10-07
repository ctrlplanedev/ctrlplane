package db

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"workspace-engine/pkg/workspace"
)

func LoadWorkspace(ctx context.Context, workspaceID string) (*workspace.Workspace, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	wg := sync.WaitGroup{}

	ws := workspace.New(workspaceID)

	var errs []error

	wg.Add(1)
	go func() {
		defer wg.Done()
		dbResources, err := GetResources(ctx, workspaceID)
		if err != nil {
			errs = append(errs, err)
			return
		}

		for _, resource := range dbResources {
			ws.Resources().Upsert(ctx, resource)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dbDeployments, err := GetDeployments(ctx, workspaceID)
		if err != nil {
			errs = append(errs, err)
			return
		}
		for _, deployment := range dbDeployments {
			ws.Deployments().Upsert(ctx, deployment)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dbDeploymentVersions, err := GetDeploymentVersions(ctx, workspaceID)
		if err != nil {
			errs = append(errs, err)
			return
		}

		for _, deploymentVersion := range dbDeploymentVersions {
			ws.DeploymentVersions().Upsert(deploymentVersion.DeploymentId, deploymentVersion)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dbDeploymentVariables, err := GetDeploymentVariables(ctx, workspaceID)
		if err != nil {
			errs = append(errs, err)
			return
		}

		for _, deploymentVariable := range dbDeploymentVariables {
			ws.Deployments().Variables(deploymentVariable.DeploymentId)[deploymentVariable.Key] = deploymentVariable
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dbEnvironments, err := GetEnvironments(ctx, workspaceID)
		if err != nil {
			errs = append(errs, err)
			return
		}
		for _, environment := range dbEnvironments {
			ws.Environments().Upsert(ctx, environment)
		}
	}()

	wg.Wait()

	if len(errs) > 0 {
		return nil, fmt.Errorf("failed to load workspace: %w", errors.Join(errs...))
	}

	return ws, nil
}
