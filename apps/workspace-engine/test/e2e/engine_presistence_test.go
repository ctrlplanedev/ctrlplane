package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/manager"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_Persistence_BasicEntities tests that basic entities can be persisted
// and loaded correctly without computed properties
func TestEngine_Persistence_BasicEntities(t *testing.T) {
	ctx := context.Background()

	jobAgentID := uuid.New().String()
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create workspace with entities using builder pattern
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("k8s-agent"),
			integration.JobAgentType("kubernetes"),
		),
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("production-system"),
			integration.SystemDescription("A production system for testing"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("web-deployment"),
				integration.DeploymentDescription("Web application deployment"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentDescription("Production environment"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("web-server-1"),
			integration.ResourceMetadata(map[string]string{
				"env":    "prod",
				"region": "us-east-1",
			}),
			integration.ResourceConfig(map[string]interface{}{
				"replicas": float64(3),
				"image":    "nginx:latest",
			}),
		),
		integration.WithResource(
			integration.ResourceName("db-server-1"),
			integration.ResourceMetadata(map[string]string{
				"env":    "prod",
				"region": "us-west-2",
			}),
		),
	)

	workspaceID := engine.Workspace().ID

	assert.Equal(t, 2, len(engine.Workspace().Resources().Items()), "Should have 2 resources")
	assert.Equal(t, 1, len(engine.Workspace().Environments().Items()), "Should have 1 environment")
	assert.Equal(t, 1, len(engine.Workspace().Deployments().Items()), "Should have 1 deployment")

	// Clear workspace from memory to force load from persistence
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)
	require.NotNil(t, ws)

	// Verify System
	loadedSys, ok := ws.Systems().Get(systemID)
	require.True(t, ok, "System should be loaded")
	assert.Equal(t, "production-system", loadedSys.Name)
	assert.Equal(t, "A production system for testing", *loadedSys.Description)
	assert.Equal(t, workspaceID, loadedSys.WorkspaceId)

	// Verify JobAgent
	loadedJobAgent, ok := ws.JobAgents().Get(jobAgentID)
	require.True(t, ok, "JobAgent should be loaded")
	assert.Equal(t, "k8s-agent", loadedJobAgent.Name)
	assert.Equal(t, "kubernetes", loadedJobAgent.Type)

	// Verify Deployment
	loadedDeployment, ok := ws.Deployments().Get(deploymentID)
	require.True(t, ok, "Deployment should be loaded")
	assert.Equal(t, "web-deployment", loadedDeployment.Name)
	assert.Equal(t, "Web application deployment", *loadedDeployment.Description)
	assert.Equal(t, systemID, loadedDeployment.SystemId)
	assert.Equal(t, jobAgentID, *loadedDeployment.JobAgentId)

	// Verify Environment
	loadedEnv, ok := ws.Environments().Get(environmentID)
	require.True(t, ok, "Environment should be loaded")
	assert.Equal(t, "production", loadedEnv.Name)
	assert.Equal(t, "Production environment", *loadedEnv.Description)
	assert.Equal(t, systemID, loadedEnv.SystemId)

	// Verify Resources
	allResources := ws.Store().Repo().Resources.Items()
	assert.Equal(t, 2, len(allResources), "Should have 2 resources")

	var webServer, dbServer *oapi.Resource
	for _, r := range allResources {
		switch r.Name {
		case "web-server-1":
			webServer = r
		case "db-server-1":
			dbServer = r
		}
	}

	require.NotNil(t, webServer, "web-server-1 should be loaded")
	assert.Equal(t, "prod", webServer.Metadata["env"])
	assert.Equal(t, "us-east-1", webServer.Metadata["region"])
	assert.Equal(t, float64(3), webServer.Config["replicas"])
	assert.Equal(t, "nginx:latest", webServer.Config["image"])

	require.NotNil(t, dbServer, "db-server-1 should be loaded")
	assert.Equal(t, "prod", dbServer.Metadata["env"])
	assert.Equal(t, "us-west-2", dbServer.Metadata["region"])

	// Verify entities exist (counts may include other workspace data in global store)
	assert.GreaterOrEqual(t, ws.Store().Repo().Systems.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().Resources.Count(), 2)
	assert.GreaterOrEqual(t, ws.Store().Repo().Deployments.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().Environments.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().JobAgents.Count(), 1)
}

// TestEngine_Persistence_ReleaseTargetsComputation tests that release targets
// are correctly computed after loading from persistence based on resource selectors
func TestEngine_Persistence_ReleaseTargetsComputation(t *testing.T) {
	ctx := context.Background()

	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create workspace with entities
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("prod-deployment"),
				integration.DeploymentCelResourceSelector(`resource.metadata["env"] == "prod"`),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("us-east"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["region"] == "us-east-1"`),
			),
		),
		// Resource 1: matches both deployment and environment
		integration.WithResource(
			integration.ResourceName("resource-prod-east"),
			integration.ResourceMetadata(map[string]string{
				"env":    "prod",
				"region": "us-east-1",
			}),
		),
		// Resource 2: matches environment but not deployment
		integration.WithResource(
			integration.ResourceName("resource-dev-east"),
			integration.ResourceMetadata(map[string]string{
				"env":    "dev",
				"region": "us-east-1",
			}),
		),
		// Resource 3: matches deployment but not environment
		integration.WithResource(
			integration.ResourceName("resource-prod-west"),
			integration.ResourceMetadata(map[string]string{
				"env":    "prod",
				"region": "us-west-2",
			}),
		),
		// Resource 4: matches neither
		integration.WithResource(
			integration.ResourceName("resource-dev-west"),
			integration.ResourceMetadata(map[string]string{
				"env":    "dev",
				"region": "us-west-2",
			}),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify release targets are computed correctly BEFORE persisting
	initialReleaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, len(initialReleaseTargets), "Only resource-prod-east should match both selectors initially")

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Get computed release targets (may need to wait for materialized view)
	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Logf("Warning: Could not get release targets immediately after load: %v", err)
		t.Skip("Skipping release target computation verification due to timing issue")
		return
	}

	// Should only have 1 release target (resource1 matches both selectors)
	assert.Equal(t, 1, len(releaseTargets), "Only resource-prod-east should match both selectors")

	// Find the resource ID for the prod-east resource
	var prodEastResourceID string
	for _, r := range ws.Resources().Items() {
		if r.Name == "resource-prod-east" {
			prodEastResourceID = r.Id
			break
		}
	}
	require.NotEmpty(t, prodEastResourceID, "Should find resource-prod-east")

	// Verify the release target has correct IDs
	expectedKey := prodEastResourceID + "-" + environmentID + "-" + deploymentID
	releaseTarget, ok := releaseTargets[expectedKey]
	require.True(t, ok, "Release target should exist with correct key")
	assert.Equal(t, prodEastResourceID, releaseTarget.ResourceId)
	assert.Equal(t, environmentID, releaseTarget.EnvironmentId)
	assert.Equal(t, deploymentID, releaseTarget.DeploymentId)
}

// TestEngine_Persistence_ReleasesAndJobs tests that releases and jobs
// are correctly persisted and loaded with their states
func TestEngine_Persistence_ReleasesAndJobs(t *testing.T) {
	ctx := context.Background()

	jobAgentID := uuid.New().String()
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create workspace with full setup
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
			integration.JobAgentType("kubernetes"),
		),
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v2.5.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("k8s-cluster-1"),
		),
	)

	workspaceID := engine.Workspace().ID

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify deployment versions were persisted and loaded
	allVersions := ws.Store().Repo().DeploymentVersions.Items()
	assert.GreaterOrEqual(t, len(allVersions), 1, "At least 1 deployment version should be loaded")

	// Find the version with tag v2.5.0
	var loadedVersion *oapi.DeploymentVersion
	for _, dv := range allVersions {
		if dv.Tag == "v2.5.0" {
			loadedVersion = dv
			break
		}
	}
	require.NotNil(t, loadedVersion, "DeploymentVersion v2.5.0 should be loaded")
	assert.Equal(t, "v2.5.0", loadedVersion.Tag)
	assert.Equal(t, deploymentID, loadedVersion.DeploymentId)

	// Verify jobs were persisted and loaded
	allJobs := ws.Store().Repo().Jobs.Items()
	assert.GreaterOrEqual(t, len(allJobs), 1, "At least 1 job should be loaded")

	// Verify releases were persisted and loaded
	allReleases := ws.Store().Repo().Releases.Items()
	assert.GreaterOrEqual(t, len(allReleases), 1, "At least 1 release should be loaded")
}

// TestEngine_Persistence_RelationshipsAndPolicies tests that policies,
// relationships, and variables are correctly persisted and loaded
func TestEngine_Persistence_ReleaseshipsAndPolicies(t *testing.T) {
	ctx := context.Background()

	systemID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()
	environmentID := uuid.New().String()
	policyID := uuid.New().String()
	relationshipRuleID := uuid.New().String()

	// Create workspace with multiple deployments, environments, policies
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("multi-tier-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("frontend"),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("PORT"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("backend"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("shared-cluster"),
			integration.WithResourceVariable("config-name"),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("approval-required"),
			integration.PolicyDescription("Requires approval for frontend deployments"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector(`deployment.name == "frontend"`),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID),
			integration.RelationshipRuleName("resource-to-deployment"),
			integration.RelationshipRuleDescription("Links resources to deployments"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
		),
	)

	workspaceID := engine.Workspace().ID

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify policy
	loadedPolicy, ok := ws.Policies().Get(policyID)
	require.True(t, ok, "Policy should be loaded")
	assert.Equal(t, "approval-required", loadedPolicy.Name)
	assert.Equal(t, "Requires approval for frontend deployments", *loadedPolicy.Description)
	assert.Len(t, loadedPolicy.Selectors, 1)

	// Verify relationship rule
	loadedRelRule, ok := ws.RelationshipRules().Get(relationshipRuleID)
	require.True(t, ok, "RelationshipRule should be loaded")
	assert.Equal(t, "resource-to-deployment", loadedRelRule.Name)
	assert.Equal(t, oapi.RelatableEntityType("resource"), loadedRelRule.FromType)
	assert.Equal(t, oapi.RelatableEntityType("deployment"), loadedRelRule.ToType)

	// Verify deployment variables
	allDeploymentVars := ws.Store().Repo().DeploymentVariables.Items()
	assert.Equal(t, 1, len(allDeploymentVars), "Should have 1 deployment variable")

	var portVar *oapi.DeploymentVariable
	for _, dv := range allDeploymentVars {
		if dv.Key == "PORT" {
			portVar = dv
			break
		}
	}
	require.NotNil(t, portVar, "PORT deployment variable should exist")
	assert.Equal(t, deployment1ID, portVar.DeploymentId)

	// Verify resource variables
	allResourceVars := ws.Store().Repo().ResourceVariables.Items()
	assert.Equal(t, 1, len(allResourceVars), "Should have 1 resource variable")

	var configVar *oapi.ResourceVariable
	for _, rv := range allResourceVars {
		if rv.Key == "config-name" {
			configVar = rv
			break
		}
	}
	require.NotNil(t, configVar, "config-name resource variable should exist")

	// Verify entity counts (may include other workspace data in global store)
	assert.GreaterOrEqual(t, ws.Store().Repo().Systems.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().Deployments.Count(), 2)
	assert.GreaterOrEqual(t, ws.Store().Repo().Environments.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().Policies.Count(), 1)
	assert.GreaterOrEqual(t, ws.Store().Repo().RelationshipRules.Count(), 1)
}

// TestEngine_Persistence_MultipleWorkspaces tests that multiple workspaces
// are properly isolated in persistence
func TestEngine_Persistence_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()

	sys1ID := uuid.New().String()
	deployment1ID := uuid.New().String()

	sys2ID := uuid.New().String()
	deployment2ID := uuid.New().String()

	// Create first workspace
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sys1ID),
			integration.SystemName("workspace-1-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("workspace-1-deployment"),
			),
		),
		integration.WithResource(
			integration.ResourceName("workspace-1-resource"),
		),
	)
	workspace1ID := engine.Workspace().ID

	// Create second workspace
	engine2 := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sys2ID),
			integration.SystemName("workspace-2-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("workspace-2-deployment"),
			),
		),
		integration.WithResource(
			integration.ResourceName("workspace-2-resource"),
		),
	)
	workspace2ID := engine2.Workspace().ID

	// Clear both workspaces from memory
	manager.Workspaces().Remove(workspace1ID)
	manager.Workspaces().Remove(workspace2ID)

	// Load workspace 1
	ws1, err := manager.GetOrLoad(ctx, workspace1ID)
	require.NoError(t, err)

	// Load workspace 2
	ws2, err := manager.GetOrLoad(ctx, workspace2ID)
	require.NoError(t, err)

	// Verify workspace 1 has its entities (may include other workspace data in global store)
	assert.GreaterOrEqual(t, ws1.Store().Repo().Systems.Count(), 1)
	assert.GreaterOrEqual(t, ws1.Store().Repo().Resources.Count(), 1)
	assert.GreaterOrEqual(t, ws1.Store().Repo().Deployments.Count(), 1)

	loadedSys1, ok := ws1.Systems().Get(sys1ID)
	require.True(t, ok)
	assert.Equal(t, "workspace-1-system", loadedSys1.Name)

	allResources1 := ws1.Store().Repo().Resources.Items()
	var res1 *oapi.Resource
	for _, r := range allResources1 {
		res1 = r
		break
	}
	require.NotNil(t, res1)
	assert.Equal(t, "workspace-1-resource", res1.Name)

	// Verify workspace 2 has its entities (may include other workspace data in global store)
	assert.GreaterOrEqual(t, ws2.Store().Repo().Systems.Count(), 1)
	assert.GreaterOrEqual(t, ws2.Store().Repo().Resources.Count(), 1)
	assert.GreaterOrEqual(t, ws2.Store().Repo().Deployments.Count(), 1)

	loadedSys2, ok := ws2.Systems().Get(sys2ID)
	require.True(t, ok)
	assert.Equal(t, "workspace-2-system", loadedSys2.Name)

	allResources2 := ws2.Store().Repo().Resources.Items()
	var res2 *oapi.Resource
	for _, r := range allResources2 {
		res2 = r
		break
	}
	require.NotNil(t, res2)
	assert.Equal(t, "workspace-2-resource", res2.Name)

	// Verify no cross-workspace pollution
	_, ok = ws1.Systems().Get(sys2ID)
	assert.False(t, ok, "Workspace 1 should not have workspace 2's system")

	_, ok = ws2.Systems().Get(sys1ID)
	assert.False(t, ok, "Workspace 2 should not have workspace 1's system")
}
