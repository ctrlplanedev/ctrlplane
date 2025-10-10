package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("db")

func loadSystems(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadSystems")
	defer span.End()

	dbSystems, err := getSystems(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get systems: %w", err)
	}
	for _, system := range dbSystems {
		ws.Systems().Upsert(ctx, system)
	}
	span.SetAttributes(attribute.Int("count", len(dbSystems)))
	return nil
}

func loadResources(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadResources")
	defer span.End()

	dbResources, err := getResources(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get resources: %w", err)
	}
	for _, resource := range dbResources {
		ws.Resources().Upsert(ctx, resource)
	}
	span.SetAttributes(attribute.Int("count", len(dbResources)))
	return nil
}

func loadDeployments(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadDeployments")
	defer span.End()

	dbDeployments, err := getDeployments(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}
	for _, deployment := range dbDeployments {
		ws.Deployments().Upsert(ctx, deployment)
	}
	span.SetAttributes(attribute.Int("count", len(dbDeployments)))
	return nil
}

func loadDeploymentVersions(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadDeploymentVersions")
	defer span.End()

	dbDeploymentVersions, err := getDeploymentVersions(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployment versions: %w", err)
	}
	for _, deploymentVersion := range dbDeploymentVersions {
		ws.DeploymentVersions().Upsert(ctx, deploymentVersion.DeploymentId, deploymentVersion)
	}
	span.SetAttributes(attribute.Int("count", len(dbDeploymentVersions)))
	return nil
}

func loadDeploymentVariables(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadDeploymentVariables")
	defer span.End()

	dbDeploymentVariables, err := getDeploymentVariables(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get deployment variables: %w", err)
	}
	for _, deploymentVariable := range dbDeploymentVariables {
		ws.Deployments().Variables(deploymentVariable.DeploymentId)[deploymentVariable.Key] = deploymentVariable
	}
	span.SetAttributes(attribute.Int("count", len(dbDeploymentVariables)))
	return nil
}

func loadEnvironments(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadEnvironments")
	defer span.End()

	dbEnvironments, err := getEnvironments(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get environments: %w", err)
	}
	for _, environment := range dbEnvironments {
		ws.Environments().Upsert(ctx, environment)
	}
	span.SetAttributes(attribute.Int("count", len(dbEnvironments)))
	return nil
}

func loadPolicies(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadPolicies")
	defer span.End()

	dbPolicies, err := getPolicies(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get policies: %w", err)
	}
	for _, policy := range dbPolicies {
		ws.Policies().Upsert(ctx, policy)
	}
	span.SetAttributes(attribute.Int("count", len(dbPolicies)))
	log.Info("Loaded policies", "count", len(dbPolicies))
	return nil
}

func loadJobAgents(ctx context.Context, ws *workspace.Workspace) error {
	ctx, span := tracer.Start(ctx, "loadJobAgents")
	defer span.End()

	dbJobAgents, err := getJobAgents(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("failed to get job agents: %w", err)
	}
	for _, jobAgent := range dbJobAgents {
		ws.JobAgents().Upsert(ctx, jobAgent)
	}
	span.SetAttributes(attribute.Int("count", len(dbJobAgents)))
	log.Info("Loaded job agents", "count", len(dbJobAgents))
	return nil
}

func LoadWorkspace(ctx context.Context, workspaceID string) (*workspace.Workspace, error) {
	ctx, span := tracer.Start(ctx, "LoadWorkspace")
	defer span.End()

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

	if err := loadJobAgents(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to load job agents: %w", err)
	}

	return ws, nil
}
