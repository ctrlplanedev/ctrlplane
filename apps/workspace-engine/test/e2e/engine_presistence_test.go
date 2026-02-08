package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
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
	allResources := ws.Resources().Items()
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
	assert.GreaterOrEqual(t, len(ws.Systems().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.Resources().Items()), 2)
	assert.GreaterOrEqual(t, len(ws.Deployments().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.Environments().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.JobAgents().Items()), 1)
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
	initialReleaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	require.NoError(t, err)
	assert.Equal(t, 1, len(initialReleaseTargets), "Only resource-prod-east should match both selectors initially")

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Get computed release targets (may need to wait for materialized view)
	releaseTargets, err := ws.ReleaseTargets().Items()
	assert.NoError(t, err)

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
	allVersions := ws.DeploymentVersions().Items()
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
	allJobs := ws.Jobs().Items()
	assert.GreaterOrEqual(t, len(allJobs), 1, "At least 1 job should be loaded")

	// Verify releases were persisted and loaded
	allReleases := ws.Releases().Items()
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
			integration.WithPolicySelector(`deployment.name == "frontend"`),
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
	assert.NotEmpty(t, loadedPolicy.Selector)

	// Verify relationship rule
	loadedRelRule, ok := ws.RelationshipRules().Get(relationshipRuleID)
	require.True(t, ok, "RelationshipRule should be loaded")
	assert.Equal(t, "resource-to-deployment", loadedRelRule.Name)
	assert.Equal(t, oapi.RelatableEntityType("resource"), loadedRelRule.FromType)
	assert.Equal(t, oapi.RelatableEntityType("deployment"), loadedRelRule.ToType)

	// Verify deployment variables
	allDeploymentVars := ws.DeploymentVariables().Items()
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
	allResourceVars := ws.ResourceVariables().Items()
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
	assert.GreaterOrEqual(t, len(ws.Systems().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.Deployments().Items()), 2)
	assert.GreaterOrEqual(t, len(ws.Environments().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.Policies().Items()), 1)
	assert.GreaterOrEqual(t, len(ws.RelationshipRules().Items()), 1)
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
	assert.GreaterOrEqual(t, len(ws1.Systems().Items()), 1)
	assert.GreaterOrEqual(t, len(ws1.Resources().Items()), 1)
	assert.GreaterOrEqual(t, len(ws1.Deployments().Items()), 1)

	loadedSys1, ok := ws1.Systems().Get(sys1ID)
	require.True(t, ok)
	assert.Equal(t, "workspace-1-system", loadedSys1.Name)

	allResources1 := ws1.Resources().Items()
	var res1 *oapi.Resource
	for _, r := range allResources1 {
		res1 = r
		break
	}
	require.NotNil(t, res1)
	assert.Equal(t, "workspace-1-resource", res1.Name)

	// Verify workspace 2 has its entities (may include other workspace data in global store)
	assert.GreaterOrEqual(t, len(ws2.Systems().Items()), 1)
	assert.GreaterOrEqual(t, len(ws2.Resources().Items()), 1)
	assert.GreaterOrEqual(t, len(ws2.Deployments().Items()), 1)

	loadedSys2, ok := ws2.Systems().Get(sys2ID)
	require.True(t, ok)
	assert.Equal(t, "workspace-2-system", loadedSys2.Name)

	allResources2 := ws2.Resources().Items()
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

// TestEngine_Persistence_ResourceDeletion tests that resource deletions
// are properly persisted and reflected after reload
func TestEngine_Persistence_ResourceDeletion(t *testing.T) {
	ctx := context.Background()

	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	resource3ID := uuid.New().String()

	// Create workspace with multiple resources
	engine := integration.NewTestWorkspace(t,
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("resource-to-keep-1"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("resource-to-delete"),
			integration.ResourceMetadata(map[string]string{"env": "staging"}),
		),
		integration.WithResource(
			integration.ResourceID(resource3ID),
			integration.ResourceName("resource-to-keep-2"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify all resources exist
	assert.Equal(t, 3, len(engine.Workspace().Resources().Items()))

	// Delete resource 2
	_, ok := engine.Workspace().Resources().Get(resource2ID)
	require.True(t, ok)

	// Use PushEvent to delete (which persists the change)
	engine.PushEvent(ctx, handler.ResourceDelete, &oapi.Resource{Id: resource2ID})

	// Verify resource 2 is gone from memory
	assert.Equal(t, 2, len(engine.Workspace().Resources().Items()))
	_, ok = engine.Workspace().Resources().Get(resource2ID)
	assert.False(t, ok, "Deleted resource should not exist in memory")

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify resource 2 is still gone after reload
	allResources := ws.Resources().Items()
	assert.Equal(t, 2, len(allResources), "Should have 2 resources after reload")

	_, ok = ws.Resources().Get(resource2ID)
	assert.False(t, ok, "Deleted resource should not exist after reload")

	// Verify other resources still exist
	res1, ok := ws.Resources().Get(resource1ID)
	require.True(t, ok, "resource-to-keep-1 should still exist")
	assert.Equal(t, "resource-to-keep-1", res1.Name)

	res3, ok := ws.Resources().Get(resource3ID)
	require.True(t, ok, "resource-to-keep-2 should still exist")
	assert.Equal(t, "resource-to-keep-2", res3.Name)
}

// TestEngine_Persistence_RelationshipRuleDeletion tests that relationship rule
// deletions are properly persisted
func TestEngine_Persistence_RelationshipRuleDeletion(t *testing.T) {
	ctx := context.Background()

	rule1ID := uuid.New().String()
	rule2ID := uuid.New().String()
	rule3ID := uuid.New().String()

	// Create workspace with multiple relationship rules
	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule1ID),
			integration.RelationshipRuleName("rule-to-keep-1"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
			integration.RelationshipRuleType("deployed-by"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule2ID),
			integration.RelationshipRuleName("rule-to-delete"),
			integration.RelationshipRuleFromType("deployment"),
			integration.RelationshipRuleToType("environment"),
			integration.RelationshipRuleType("deploys-to"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule3ID),
			integration.RelationshipRuleName("rule-to-keep-2"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("depends-on"),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify all rules exist
	assert.Equal(t, 3, len(engine.Workspace().RelationshipRules().Items()))

	// Delete rule 2
	engine.PushEvent(ctx, handler.RelationshipRuleDelete, &oapi.RelationshipRule{Id: rule2ID})

	// Verify rule 2 is gone from memory
	assert.Equal(t, 2, len(engine.Workspace().RelationshipRules().Items()))

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify rule 2 is still gone after reload
	allRules := ws.RelationshipRules().Items()
	assert.Equal(t, 2, len(allRules), "Should have 2 rules after reload")

	_, ok := ws.RelationshipRules().Get(rule2ID)
	assert.False(t, ok, "Deleted rule should not exist after reload")

	// Verify other rules still exist
	rule1, ok := ws.RelationshipRules().Get(rule1ID)
	require.True(t, ok, "rule-to-keep-1 should still exist")
	assert.Equal(t, "rule-to-keep-1", rule1.Name)

	rule3, ok := ws.RelationshipRules().Get(rule3ID)
	require.True(t, ok, "rule-to-keep-2 should still exist")
	assert.Equal(t, "rule-to-keep-2", rule3.Name)
}

// TestEngine_Persistence_DeploymentDeletion tests that deployment deletions
// are properly persisted including cascading deletions
func TestEngine_Persistence_DeploymentDeletion(t *testing.T) {
	ctx := context.Background()

	systemID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()

	// Create workspace with multiple deployments
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("deployment-to-keep"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("deployment-to-delete"),
				integration.DeploymentCelResourceSelector("true"),
			),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify both deployments exist
	assert.Equal(t, 2, len(engine.Workspace().Deployments().Items()))

	// Delete deployment 2
	_, ok := engine.Workspace().Deployments().Get(deployment2ID)
	require.True(t, ok)
	engine.PushEvent(ctx, handler.DeploymentDelete, &oapi.Deployment{Id: deployment2ID})

	// Verify deployment 2 is gone from memory
	assert.Equal(t, 1, len(engine.Workspace().Deployments().Items()))

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify deployment 2 is still gone after reload
	allDeployments := ws.Deployments().Items()
	assert.Equal(t, 1, len(allDeployments), "Should have 1 deployment after reload")

	_, ok = ws.Deployments().Get(deployment2ID)
	assert.False(t, ok, "Deleted deployment should not exist after reload")

	// Verify deployment 1 still exists
	dep1, ok := ws.Deployments().Get(deployment1ID)
	require.True(t, ok, "deployment-to-keep should still exist")
	assert.Equal(t, "deployment-to-keep", dep1.Name)
}

// TestEngine_Persistence_PolicyDeletion tests that policy deletions
// are properly persisted
func TestEngine_Persistence_PolicyDeletion(t *testing.T) {
	ctx := context.Background()

	policy1ID := uuid.New().String()
	policy2ID := uuid.New().String()

	// Create workspace with multiple policies
	engine := integration.NewTestWorkspace(t,
		integration.WithPolicy(
			integration.PolicyID(policy1ID),
			integration.PolicyName("policy-to-keep"),
			integration.PolicyDescription("A policy to keep"),
		),
		integration.WithPolicy(
			integration.PolicyID(policy2ID),
			integration.PolicyName("policy-to-delete"),
			integration.PolicyDescription("A policy to delete"),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify both policies exist
	assert.Equal(t, 2, len(engine.Workspace().Policies().Items()))

	// Delete policy 2
	_, ok := engine.Workspace().Policies().Get(policy2ID)
	require.True(t, ok)
	engine.PushEvent(ctx, handler.PolicyDelete, &oapi.Policy{Id: policy2ID})

	// Verify policy 2 is gone from memory
	assert.Equal(t, 1, len(engine.Workspace().Policies().Items()))

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify policy 2 is still gone after reload
	allPolicies := ws.Policies().Items()
	assert.Equal(t, 1, len(allPolicies), "Should have 1 policy after reload")

	_, ok = ws.Policies().Get(policy2ID)
	assert.False(t, ok, "Deleted policy should not exist after reload")

	// Verify policy 1 still exists
	pol1, ok := ws.Policies().Get(policy1ID)
	require.True(t, ok, "policy-to-keep should still exist")
	assert.Equal(t, "policy-to-keep", pol1.Name)
}

// TestEngine_Persistence_SystemDeletion tests that system deletions
// are properly persisted including cascading deletions of deployments and environments
func TestEngine_Persistence_SystemDeletion(t *testing.T) {
	ctx := context.Background()

	system1ID := uuid.New().String()
	system2ID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()

	// Create workspace with multiple systems
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(system1ID),
			integration.SystemName("system-to-keep"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("deployment-in-kept-system"),
			),
		),
		integration.WithSystem(
			integration.SystemID(system2ID),
			integration.SystemName("system-to-delete"),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("deployment-in-deleted-system"),
			),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify both systems exist
	assert.Equal(t, 2, len(engine.Workspace().Systems().Items()))
	assert.Equal(t, 2, len(engine.Workspace().Deployments().Items()))

	// Delete system 2
	_, ok := engine.Workspace().Systems().Get(system2ID)
	require.True(t, ok)
	engine.PushEvent(ctx, handler.SystemDelete, &oapi.System{Id: system2ID})

	// Verify system 2 and its deployment are gone from memory
	assert.Equal(t, 1, len(engine.Workspace().Systems().Items()))
	assert.Equal(t, 1, len(engine.Workspace().Deployments().Items()))

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify system 2 is still gone after reload
	allSystems := ws.Systems().Items()
	assert.Equal(t, 1, len(allSystems), "Should have 1 system after reload")

	_, ok = ws.Systems().Get(system2ID)
	assert.False(t, ok, "Deleted system should not exist after reload")

	// Verify deployment 2 is also gone (cascading delete)
	_, ok = ws.Deployments().Get(deployment2ID)
	assert.False(t, ok, "Deployment in deleted system should not exist after reload")

	// Verify system 1 and its deployment still exist
	sys1, ok := ws.Systems().Get(system1ID)
	require.True(t, ok, "system-to-keep should still exist")
	assert.Equal(t, "system-to-keep", sys1.Name)

	dep1, ok := ws.Deployments().Get(deployment1ID)
	require.True(t, ok, "deployment-in-kept-system should still exist")
	assert.Equal(t, "deployment-in-kept-system", dep1.Name)
}

// TestEngine_Persistence_MultipleDeletions tests that multiple entity deletions
// across different types are properly persisted
func TestEngine_Persistence_MultipleDeletions(t *testing.T) {
	ctx := context.Background()

	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	resource3ID := uuid.New().String()
	ruleID := uuid.New().String()
	policyID := uuid.New().String()

	// Create workspace with various entities
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemID),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("test-environment"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("resource-2-to-delete"),
		),
		integration.WithResource(
			integration.ResourceID(resource3ID),
			integration.ResourceName("resource-3-to-delete"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("rule-to-delete"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("policy-to-delete"),
		),
	)

	workspaceID := engine.Workspace().ID

	// Verify initial state
	assert.Equal(t, 3, len(engine.Workspace().Resources().Items()))
	assert.Equal(t, 1, len(engine.Workspace().RelationshipRules().Items()))
	assert.Equal(t, 1, len(engine.Workspace().Policies().Items()))

	// Delete multiple entities
	engine.PushEvent(ctx, handler.ResourceDelete, &oapi.Resource{Id: resource2ID})
	engine.PushEvent(ctx, handler.ResourceDelete, &oapi.Resource{Id: resource3ID})
	engine.PushEvent(ctx, handler.RelationshipRuleDelete, &oapi.RelationshipRule{Id: ruleID})
	engine.PushEvent(ctx, handler.PolicyDelete, &oapi.Policy{Id: policyID})

	// Verify deletions in memory
	assert.Equal(t, 1, len(engine.Workspace().Resources().Items()))
	assert.Equal(t, 0, len(engine.Workspace().RelationshipRules().Items()))
	assert.Equal(t, 0, len(engine.Workspace().Policies().Items()))

	// Clear workspace from memory
	manager.Workspaces().Remove(workspaceID)

	// Load workspace from persistence
	ws, err := manager.GetOrLoad(ctx, workspaceID)
	require.NoError(t, err)

	// Verify all deletions persisted
	allResources := ws.Resources().Items()
	assert.Equal(t, 1, len(allResources), "Should have 1 resource after reload")

	res1, ok := ws.Resources().Get(resource1ID)
	require.True(t, ok, "resource-1 should exist")
	assert.Equal(t, "resource-1", res1.Name)

	_, ok = ws.Resources().Get(resource2ID)
	assert.False(t, ok, "resource-2 should be deleted")

	_, ok = ws.Resources().Get(resource3ID)
	assert.False(t, ok, "resource-3 should be deleted")

	allRules := ws.RelationshipRules().Items()
	assert.Equal(t, 0, len(allRules), "Should have 0 rules after reload")

	allPolicies := ws.Policies().Items()
	assert.Equal(t, 0, len(allPolicies), "Should have 0 policies after reload")

	// Verify system, deployment, and environment still exist
	sys, ok := ws.Systems().Get(systemID)
	require.True(t, ok)
	assert.Equal(t, "test-system", sys.Name)

	dep, ok := ws.Deployments().Get(deploymentID)
	require.True(t, ok)
	assert.Equal(t, "test-deployment", dep.Name)

	env, ok := ws.Environments().Get(environmentID)
	require.True(t, ok)
	assert.Equal(t, "test-environment", env.Name)
}
