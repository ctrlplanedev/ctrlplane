package creators

import (
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func NewWorkflowTemplate(workspaceID string) *oapi.WorkflowTemplate {
	id := uuid.New().String()
	idSubstring := id[:8]

	workflowTemplate := &oapi.WorkflowTemplate{
		Id:     id,
		Name:   fmt.Sprintf("workflow-template-%s", idSubstring),
		Inputs: []oapi.WorkflowInput{},
		Jobs:   []oapi.WorkflowJobTemplate{},
	}

	return workflowTemplate
}

func NewStringWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     name,
		Type:    oapi.String,
		Default: nil,
	})
	return input
}

func NewNumberWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     name,
		Type:    oapi.Number,
		Default: nil,
	})
	return input
}

func NewBooleanWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     name,
		Type:    oapi.Boolean,
		Default: nil,
	})
	return input
}

func NewWorkflowJobTemplate(workflowTemplateID string) *oapi.WorkflowJobTemplate {
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
