package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("db")

type InitialWorkspaceState struct {
	systems             []*oapi.System
	resources           []*oapi.Resource
	deployments         []*oapi.Deployment
	deploymentVersions  []*oapi.DeploymentVersion
	deploymentVariables []*oapi.DeploymentVariable
	releases            []*oapi.Release
	jobs                []*oapi.Job
	environments        []*oapi.Environment
	policies            []*oapi.Policy
	jobAgents           []*oapi.JobAgent
	relationships       []*oapi.RelationshipRule
	githubEntities      []*oapi.GithubEntity
	userApprovalRecords []*oapi.UserApprovalRecord
}

func (i *InitialWorkspaceState) Systems() []*oapi.System {
	return i.systems
}

func (i *InitialWorkspaceState) Resources() []*oapi.Resource {
	return i.resources
}

func (i *InitialWorkspaceState) Deployments() []*oapi.Deployment {
	return i.deployments
}

func (i *InitialWorkspaceState) DeploymentVersions() []*oapi.DeploymentVersion {
	return i.deploymentVersions
}

func (i *InitialWorkspaceState) DeploymentVariables() []*oapi.DeploymentVariable {
	return i.deploymentVariables
}

func (i *InitialWorkspaceState) Releases() []*oapi.Release {
	return i.releases
}

func (i *InitialWorkspaceState) Jobs() []*oapi.Job {
	return i.jobs
}

func (i *InitialWorkspaceState) Environments() []*oapi.Environment {
	return i.environments
}

func (i *InitialWorkspaceState) Policies() []*oapi.Policy {
	return i.policies
}

func (i *InitialWorkspaceState) JobAgents() []*oapi.JobAgent {
	return i.jobAgents
}

func (i *InitialWorkspaceState) Relationships() []*oapi.RelationshipRule {
	return i.relationships
}

func (i *InitialWorkspaceState) GithubEntities() []*oapi.GithubEntity {
	return i.githubEntities
}

func (i *InitialWorkspaceState) UserApprovalRecords() []*oapi.UserApprovalRecord {
	return i.userApprovalRecords
}

func loadSystems(ctx context.Context, workspaceID string) ([]*oapi.System, error) {
	ctx, span := tracer.Start(ctx, "loadSystems")
	defer span.End()

	dbSystems, err := getSystems(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get systems: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbSystems)))
	return dbSystems, nil
}

func loadResources(ctx context.Context, workspaceID string) ([]*oapi.Resource, error) {
	ctx, span := tracer.Start(ctx, "loadResources")
	defer span.End()

	dbResources, err := getResources(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resources: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbResources)))
	return dbResources, nil
}

func loadDeployments(ctx context.Context, workspaceID string) ([]*oapi.Deployment, error) {
	ctx, span := tracer.Start(ctx, "loadDeployments")
	defer span.End()

	dbDeployments, err := getDeployments(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployments: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbDeployments)))
	return dbDeployments, nil
}

func loadDeploymentVersions(ctx context.Context, workspaceID string) ([]*oapi.DeploymentVersion, error) {
	ctx, span := tracer.Start(ctx, "loadDeploymentVersions")
	defer span.End()

	dbDeploymentVersions, err := getDeploymentVersions(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment versions: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbDeploymentVersions)))
	return dbDeploymentVersions, nil
}

func loadDeploymentVariables(ctx context.Context, workspaceID string) ([]*oapi.DeploymentVariable, error) {
	ctx, span := tracer.Start(ctx, "loadDeploymentVariables")
	defer span.End()

	dbDeploymentVariables, err := getDeploymentVariables(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment variables: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbDeploymentVariables)))
	return dbDeploymentVariables, nil
}

func loadEnvironments(ctx context.Context, workspaceID string) ([]*oapi.Environment, error) {
	ctx, span := tracer.Start(ctx, "loadEnvironments")
	defer span.End()

	dbEnvironments, err := getEnvironments(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get environments: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbEnvironments)))
	return dbEnvironments, nil
}

func loadPolicies(ctx context.Context, workspaceID string) ([]*oapi.Policy, error) {
	ctx, span := tracer.Start(ctx, "loadPolicies")
	defer span.End()

	dbPolicies, err := getPolicies(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get policies: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbPolicies)))
	return dbPolicies, nil
}

func loadJobAgents(ctx context.Context, workspaceID string) ([]*oapi.JobAgent, error) {
	ctx, span := tracer.Start(ctx, "loadJobAgents")
	defer span.End()

	dbJobAgents, err := getJobAgents(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get job agents: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbJobAgents)))
	return dbJobAgents, nil
}

func loadRelationships(ctx context.Context, workspaceID string) ([]*oapi.RelationshipRule, error) {
	ctx, span := tracer.Start(ctx, "loadRelationships")
	defer span.End()

	dbRelationships, err := getRelationships(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get relationships: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbRelationships)))
	return dbRelationships, nil
}

func loadUserApprovalRecords(ctx context.Context, workspaceID string) ([]*oapi.UserApprovalRecord, error) {
	ctx, span := tracer.Start(ctx, "loadUserApprovalRecords")
	defer span.End()

	dbUserApprovalRecords, err := getUserApprovalRecords(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user approval records: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbUserApprovalRecords)))
	return dbUserApprovalRecords, nil
}

func loadGithubEntities(ctx context.Context, workspaceID string) ([]*oapi.GithubEntity, error) {
	ctx, span := tracer.Start(ctx, "loadGithubEntities")
	defer span.End()

	dbGithubEntities, err := getGithubEntities(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get github entities: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbGithubEntities)))
	return dbGithubEntities, nil
}

func loadReleases(ctx context.Context, workspaceID string) ([]*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "loadReleases")
	defer span.End()

	dbReleases, err := getReleases(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get releases: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbReleases)))
	return dbReleases, nil
}

func loadJobs(ctx context.Context, workspaceID string) ([]*oapi.Job, error) {
	ctx, span := tracer.Start(ctx, "loadJobs")
	defer span.End()

	dbJobs, err := getJobs(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get jobs: %w", err)
	}
	span.SetAttributes(attribute.Int("count", len(dbJobs)))
	return dbJobs, nil
}

func LoadWorkspace(ctx context.Context, workspaceID string) (initialWorkspaceState *InitialWorkspaceState, err error) {
	ctx, span := tracer.Start(ctx, "LoadWorkspace")
	defer span.End()

	log.Info("Loading workspace from database", "workspaceID", workspaceID)
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	initialWorkspaceState = &InitialWorkspaceState{}

	if initialWorkspaceState.systems, err = loadSystems(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load systems: %w", err)
	}

	if initialWorkspaceState.resources, err = loadResources(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load resources: %w", err)
	}

	if initialWorkspaceState.deployments, err = loadDeployments(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load deployments: %w", err)
	}

	if initialWorkspaceState.deploymentVersions, err = loadDeploymentVersions(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load deployment versions: %w", err)
	}

	if initialWorkspaceState.deploymentVariables, err = loadDeploymentVariables(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load deployment variables: %w", err)
	}

	if initialWorkspaceState.environments, err = loadEnvironments(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load environments: %w", err)
	}

	if initialWorkspaceState.policies, err = loadPolicies(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load policies: %w", err)
	}

	if initialWorkspaceState.jobAgents, err = loadJobAgents(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load job agents: %w", err)
	}

	if initialWorkspaceState.relationships, err = loadRelationships(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load relationships: %w", err)
	}

	if initialWorkspaceState.userApprovalRecords, err = loadUserApprovalRecords(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load user approval records: %w", err)
	}

	if initialWorkspaceState.githubEntities, err = loadGithubEntities(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load github entities: %w", err)
	}

	if initialWorkspaceState.releases, err = loadReleases(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load releases: %w", err)
	}

	if initialWorkspaceState.jobs, err = loadJobs(ctx, workspaceID); err != nil {
		return nil, fmt.Errorf("failed to load jobs: %w", err)
	}

	log.Info("Workspace loaded from database", "workspaceID", workspaceID)

	return initialWorkspaceState, nil
}
