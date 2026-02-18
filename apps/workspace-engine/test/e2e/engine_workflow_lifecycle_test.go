package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_WorkflowLifecycle_UpdateWorkflow(t *testing.T) {
	workflowID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithWorkflow(
			integration.WorkflowID(workflowID),
			integration.WorkflowName("deploy-workflow"),
			integration.WithWorkflowStringInput(
				integration.WorkflowStringInputKey("env"),
				integration.WorkflowStringInputDefault("staging"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateName("deploy-step"),
			),
		),
	)

	ctx := context.Background()

	// Verify workflow exists
	workflow, ok := engine.Workspace().Workflows().Get(workflowID)
	assert.True(t, ok)
	assert.Equal(t, "deploy-workflow", workflow.Name)

	// Verify Items()
	items := engine.Workspace().Workflows().Items()
	assert.Len(t, items, 1)

	// Update workflow name via event
	workflow.Name = "updated-workflow"
	engine.PushEvent(ctx, handler.WorkflowUpdate, workflow)

	updated, ok := engine.Workspace().Workflows().Get(workflowID)
	assert.True(t, ok)
	assert.Equal(t, "updated-workflow", updated.Name)
}

func TestEngine_WorkflowLifecycle_WorkflowRunAccess(t *testing.T) {
	workflowID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithWorkflow(
			integration.WorkflowID(workflowID),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateName("step"),
			),
		),
	)

	ctx := context.Background()

	// Create workflow runs
	engine.PushEvent(ctx, handler.WorkflowRunCreate, &oapi.WorkflowRun{
		WorkflowId: workflowID,
		Inputs:     map[string]any{"key": "run-1"},
	})
	engine.PushEvent(ctx, handler.WorkflowRunCreate, &oapi.WorkflowRun{
		WorkflowId: workflowID,
		Inputs:     map[string]any{"key": "run-2"},
	})

	// Verify Items()
	allRuns := engine.Workspace().WorkflowRuns().Items()
	assert.Len(t, allRuns, 2)

	// Verify GetByWorkflowId()
	runs := engine.Workspace().WorkflowRuns().GetByWorkflowId(workflowID)
	assert.Len(t, runs, 2)

	// Verify Get() for individual run
	for id, run := range allRuns {
		got, ok := engine.Workspace().WorkflowRuns().Get(id)
		assert.True(t, ok)
		assert.Equal(t, run.WorkflowId, got.WorkflowId)
	}
}

func TestEngine_WorkflowLifecycle_WorkflowJobItems(t *testing.T) {
	workflowID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithWorkflow(
			integration.WorkflowID(workflowID),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateName("step-1"),
			),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateName("step-2"),
			),
		),
	)

	ctx := context.Background()

	engine.PushEvent(ctx, handler.WorkflowRunCreate, &oapi.WorkflowRun{
		WorkflowId: workflowID,
	})

	// Verify workflow jobs Items()
	wfJobs := engine.Workspace().WorkflowJobs().Items()
	assert.Len(t, wfJobs, 2)
}
