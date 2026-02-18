package e2e

import (
	"testing"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_WorkspaceAccessors tests various workspace accessors and store accessors.
func TestEngine_WorkspaceAccessors(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	ruleID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server"),
		),
		integration.WithWorkflow(
			integration.WorkflowID(workflowID),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateName("step"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("test-rule"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("test"),
			integration.RelationshipRuleFromCelSelector("true"),
			integration.RelationshipRuleToCelSelector("true"),
			integration.WithCelMatcher("true"),
		),
	)

	ws := engine.Workspace()

	// Test Store accessor
	assert.NotNil(t, ws.Store())

	// Test ReleaseManager accessor
	assert.NotNil(t, ws.ReleaseManager())

	// Test VerificationManager accessor
	assert.NotNil(t, ws.ReleaseManager().VerificationManager())

	// Test WorkflowManager accessor
	assert.NotNil(t, ws.WorkflowManager())

	// Test ActionOrchestrator accessor
	assert.NotNil(t, ws.ActionOrchestrator())

	// Test WorkflowActionOrchestrator accessor
	assert.NotNil(t, ws.WorkflowActionOrchestrator())

	// Test JobAgentRegistry accessor
	assert.NotNil(t, ws.JobAgentRegistry())

	// Test individual store accessors
	assert.NotNil(t, ws.DeploymentVersions())
	assert.NotNil(t, ws.Environments())
	assert.NotNil(t, ws.Deployments())
	assert.NotNil(t, ws.Resources())
	assert.NotNil(t, ws.ReleaseTargets())
	assert.NotNil(t, ws.Systems())
	assert.NotNil(t, ws.Jobs())
	assert.NotNil(t, ws.JobAgents())
	assert.NotNil(t, ws.Releases())
	assert.NotNil(t, ws.GithubEntities())
	assert.NotNil(t, ws.UserApprovalRecords())
	assert.NotNil(t, ws.RelationshipRules())
	assert.NotNil(t, ws.ResourceVariables())
	assert.NotNil(t, ws.Variables())
	assert.NotNil(t, ws.DeploymentVariables())
	assert.NotNil(t, ws.ResourceProviders())
	assert.NotNil(t, ws.Changeset())
	assert.NotNil(t, ws.DeploymentVariableValues())
	assert.NotNil(t, ws.Relations())
	assert.NotNil(t, ws.Workflows())
	assert.NotNil(t, ws.WorkflowJobTemplates())
	assert.NotNil(t, ws.WorkflowRuns())
	assert.NotNil(t, ws.WorkflowJobs())
	assert.NotNil(t, ws.Policies())

	// Test getting specific items
	_, ok := ws.Deployments().Get(deploymentID)
	assert.True(t, ok)

	_, ok = ws.Environments().Get(environmentID)
	assert.True(t, ok)

	_, ok = ws.Resources().Get(resourceID)
	assert.True(t, ok)

	_, ok = ws.Workflows().Get(workflowID)
	assert.True(t, ok)

	_, ok = ws.RelationshipRules().Get(ruleID)
	assert.True(t, ok)

	_, ok = ws.JobAgents().Get(jobAgentID)
	assert.True(t, ok)
}
