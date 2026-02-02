package workflows

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func HandleWorkflowTemplateCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflowTemplate := &oapi.WorkflowTemplate{}
	if err := json.Unmarshal(event.Data, workflowTemplate); err != nil {
		return err
	}
	ws.WorkflowTemplates().Upsert(ctx, workflowTemplate)
	return nil
}

func HandleWorkflowCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	workflow := &oapi.Workflow{}
	if err := json.Unmarshal(event.Data, workflow); err != nil {
		return err
	}

	if _, err := ws.WorkflowManager().CreateWorkflow(ctx, workflow.WorkflowTemplateId, workflow.Inputs); err != nil {
		return err
	}
	return nil
}
