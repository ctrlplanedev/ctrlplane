package workflows

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandleWorkflowCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflow := &oapi.Workflow{}
	if err := json.Unmarshal(event.Data, workflow); err != nil {
		return err
	}
	ws.Workflows().Upsert(ctx, workflow)
	return nil
}

func HandleWorkflowUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflow := &oapi.Workflow{}
	if err := json.Unmarshal(event.Data, workflow); err != nil {
		return err
	}
	ws.Workflows().Upsert(ctx, workflow)
	return nil
}

func HandleWorkflowDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflow := &oapi.Workflow{}
	if err := json.Unmarshal(event.Data, workflow); err != nil {
		return err
	}
	ws.Workflows().Remove(ctx, workflow.Id)
	return nil
}

func HandleWorkflowRunCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflowRun := &oapi.WorkflowRun{}
	if err := json.Unmarshal(event.Data, workflowRun); err != nil {
		return err
	}

	if _, err := ws.WorkflowManager().CreateWorkflowRun(ctx, workflowRun.WorkflowId, workflowRun.Inputs); err != nil {
		return err
	}
	return nil
}
