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
		Steps:  []oapi.WorkflowStepTemplate{},
	}

	return workflowTemplate
}

func NewStringWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Name:    name,
		Type:    oapi.String,
		Default: "",
	})
	return input
}

func NewNumberWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Name:    name,
		Type:    oapi.Number,
		Default: 0,
	})
	return input
}

func NewBooleanWorkflowInput(workflowTemplateID string) *oapi.WorkflowInput {
	input := &oapi.WorkflowInput{}
	name := fmt.Sprintf("test-input-%s", uuid.New().String()[:8])
	_ = input.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Name:    name,
		Type:    oapi.Boolean,
		Default: false,
	})
	return input
}

func NewWorkflowStepTemplate(workflowTemplateID string) *oapi.WorkflowStepTemplate {
	id := uuid.New().String()
	idSubstring := id[:8]
	stepTemplate := &oapi.WorkflowStepTemplate{
		Id:   id,
		Name: fmt.Sprintf("test-step-%s", idSubstring),
		JobAgent: oapi.WorkflowJobAgentConfig{
			Id:     "",
			Config: make(map[string]any),
		},
	}
	return stepTemplate
}
