package creators

import (
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func NewWorkflow(workspaceID string) *oapi.Workflow {
	id := uuid.New().String()
	idSubstring := id[:8]

	workflow := &oapi.Workflow{
		Id:     id,
		Name:   fmt.Sprintf("workflow-template-%s", idSubstring),
		Inputs: []oapi.WorkflowInput{},
		Jobs:   []oapi.WorkflowJobTemplate{},
	}

	return workflow
}

func NewStringWorkflowInput(workflowID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     name,
		Type:    oapi.String,
		Default: nil,
	})
	return input
}

func NewNumberWorkflowInput(workflowID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     name,
		Type:    oapi.Number,
		Default: nil,
	})
	return input
}

func NewBooleanWorkflowInput(workflowID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     name,
		Type:    oapi.Boolean,
		Default: nil,
	})
	return input
}

func NewWorkflowJobTemplate(workflowID string) *oapi.WorkflowJobTemplate {
	id := uuid.New().String()
	idSubstring := id[:8]
	jobTemplate := &oapi.WorkflowJobTemplate{
		Id:     id,
		Name:   fmt.Sprintf("test-job-%s", idSubstring),
		Ref:    "",
		Config: make(map[string]any),
	}
	return jobTemplate
}
