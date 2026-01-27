package workflowmanager

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type WorkflowManager struct {
	store *store.Store
}

func NewWorkflowManager(store *store.Store) *WorkflowManager {
	return &WorkflowManager{
		store: store,
	}
}

func isJobCompleted(job *oapi.Job) bool {
	return job.Status != oapi.JobStatusPending && job.Status != oapi.JobStatusInProgress
}

// createWorkflow creates and stores a new workflow with inputs
func (m *WorkflowManager) createWorkflow(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate, inputs map[string]interface{}) *oapi.Workflow {
	wf := &oapi.Workflow{
		Id:                 uuid.New().String(),
		WorkflowTemplateId: workflowTemplate.Id,
		Inputs:             inputs,
	}

	m.store.Workflows.Upsert(ctx, wf)

	return wf
}

// getNextStepTemplate gets the next step template to execute based on the current workflow step
// this function will take into account current step status and dependencies
func (m *WorkflowManager) getNextStepTemplate(workflow *oapi.Workflow) (*oapi.WorkflowStepTemplate, error) {
	workflowTemplate, ok := m.store.WorkflowTemplates.Get(workflow.WorkflowTemplateId)
	if !ok {
		return nil, fmt.Errorf("workflow template %s not found", workflow.WorkflowTemplateId)
	}

	for _, stepTemplate := range workflowTemplate.Steps {
		step, ok := m.store.WorkflowSteps.Get(stepTemplate.Id)
		if !ok {
			return &stepTemplate, nil
		}

		jobs := m.store.Jobs.GetByWorkflowStepId(step.Id)
		if len(jobs) == 0 {
			return &stepTemplate, nil
		}

		// if any job is not completed, return nil as this step is still in progress
		// the hooks will retrigger this engine once those jobs complete
		for _, job := range jobs {
			if !isJobCompleted(job) {
				return nil, nil
			}
		}
	}

	return nil, nil
}

// createWorkflowStep creates and stores a new workflow step
// it will template the config of the step template with the inputs of the workflow
func (m *WorkflowManager) createWorkflowStep(ctx context.Context, workflow *oapi.Workflow, stepTemplate *oapi.WorkflowStepTemplate) (*oapi.WorkflowStep, error) {
	data := map[string]interface{}{
		"workflow": workflow.Map(),
	}

	resolvedConfig, err := templatefuncs.RenderMap(stepTemplate.JobAgent.Config, data)
	if err != nil {
		return nil, fmt.Errorf("failed to render job agent config: %w", err)
	}

	step := &oapi.WorkflowStep{
		Id:                     uuid.New().String(),
		WorkflowId:             workflow.Id,
		WorkflowStepTemplateId: stepTemplate.Id,
		JobAgent: &struct {
			Config map[string]interface{} `json:"config"`
			Id     string                 `json:"id"`
		}{
			Id:     stepTemplate.JobAgent.Id,
			Config: resolvedConfig,
		},
	}

	m.store.WorkflowSteps.Upsert(ctx, step)
	return step, nil
}

// dispatchJobForStep dispatches a job for the given step
func (m *WorkflowManager) dispatchJobForStep(ctx context.Context, workflow *oapi.Workflow, step *oapi.WorkflowStep) error {
	job := &oapi.Job{
		Id:             uuid.New().String(),
		WorkflowStepId: step.Id,
		JobAgentId:     step.JobAgent.Id,
		JobAgentConfig: step.JobAgent.Config,
	}
}

// CreateWorkflow creates and runs a new workflow
func (m *WorkflowManager) CreateWorkflow(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate, inputs map[string]interface{}) error {
	workflow := m.createWorkflow(ctx, workflowTemplate, inputs)

	nextStepTemplate, err := m.getNextStepTemplate(workflow)
	if err != nil {
		return err
	}

	if nextStepTemplate == nil {
		return nil
	}

	step, err := m.createWorkflowStep(ctx, workflow, nextStepTemplate)
	if err != nil {
		return err
	}

	return m.dispatchJobForStep(ctx, workflow, step)
}

// ContinueWorkflow continues a workflow from the given step
func (m *WorkflowManager) ContinueWorkflow(ctx context.Context, workflow *oapi.Workflow) error {
	nextStepTemplate, err := m.getNextStepTemplate(workflow)
	if err != nil {
		return err
	}

	step, err := m.createWorkflowStep(ctx, workflow, nextStepTemplate)
	if err != nil {
		return err
	}

	return m.dispatchJobForStep(ctx, workflow, step)
}
