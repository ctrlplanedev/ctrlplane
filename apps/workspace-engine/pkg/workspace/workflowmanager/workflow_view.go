package workflowmanager

import (
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type WorkflowView struct {
	store    *store.Store
	workflow *oapi.Workflow
	steps    []*oapi.WorkflowStep

	stepJobs map[string][]*oapi.Job
}

func NewWorkflowView(store *store.Store, workflowId string) (*WorkflowView, error) {
	workflow, ok := store.Workflows.Get(workflowId)
	if !ok {
		return nil, fmt.Errorf("workflow %s not found", workflowId)
	}
	steps := store.WorkflowSteps.GetByWorkflowId(workflowId)
	sort.Slice(steps, func(i, j int) bool {
		return steps[i].Index < steps[j].Index
	})

	stepJobs := make(map[string][]*oapi.Job)
	for _, step := range steps {
		stepJobs[step.Id] = store.Jobs.GetByWorkflowStepId(step.Id)
	}

	return &WorkflowView{
		store:    store,
		workflow: workflow,
		steps:    steps,
		stepJobs: stepJobs,
	}, nil
}

func (w *WorkflowView) IsComplete() bool {
	for _, step := range w.steps {
		if !w.isStepComplete(step.Id) {
			return false
		}
	}
	return true
}

func (w *WorkflowView) isStepComplete(stepId string) bool {
	if len(w.stepJobs[stepId]) == 0 {
		return false
	}

	for _, job := range w.stepJobs[stepId] {
		if !job.IsInTerminalState() {
			return false
		}
	}
	return true
}

func (w *WorkflowView) isStepInProgress(stepId string) bool {
	for _, job := range w.stepJobs[stepId] {
		if !job.IsInTerminalState() {
			return true
		}
	}
	return false
}

func (w *WorkflowView) HasActiveJobs() bool {
	for _, stepJobs := range w.stepJobs {
		for _, job := range stepJobs {
			if !job.IsInTerminalState() {
				return true
			}
		}
	}
	return false
}

func (w *WorkflowView) GetNextStep() *oapi.WorkflowStep {
	for _, step := range w.steps {
		if !w.isStepComplete(step.Id) {
			if w.isStepInProgress(step.Id) {
				return nil
			}
			return step
		}
	}
	return nil
}

func (w *WorkflowView) GetWorkflow() *oapi.Workflow {
	return w.workflow
}

func (w *WorkflowView) GetSteps() []*oapi.WorkflowStep {
	return w.steps
}

func (w *WorkflowView) GetStep(index int) *oapi.WorkflowStep {
	return w.steps[index]
}
