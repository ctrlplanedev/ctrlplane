package workflowmanager

import (
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type WorkflowView struct {
	store        *store.Store
	workflow     *oapi.Workflow
	workflowJobs []*oapi.WorkflowJob
	jobs         map[string][]*oapi.Job
}

func NewWorkflowView(store *store.Store, workflowId string) (*WorkflowView, error) {
	workflow, ok := store.Workflows.Get(workflowId)
	if !ok {
		return nil, fmt.Errorf("workflow %s not found", workflowId)
	}
	workflowJobs := store.WorkflowJobs.GetByWorkflowId(workflowId)
	sort.Slice(workflowJobs, func(i, j int) bool {
		return workflowJobs[i].Index < workflowJobs[j].Index
	})

	jobs := make(map[string][]*oapi.Job)
	for _, wfJob := range workflowJobs {
		jobs[wfJob.Id] = store.Jobs.GetByWorkflowJobId(wfJob.Id)
	}

	return &WorkflowView{
		store:        store,
		workflow:     workflow,
		workflowJobs: workflowJobs,
		jobs:         jobs,
	}, nil
}

func (w *WorkflowView) IsComplete() bool {
	for _, wfJob := range w.workflowJobs {
		jobs := w.jobs[wfJob.Id]
		if len(jobs) == 0 {
			return false
		}
		for _, job := range jobs {
			if !job.IsInTerminalState() {
				return false
			}
		}
	}
	return true
}

func (w *WorkflowView) GetWorkflow() *oapi.Workflow {
	return w.workflow
}

func (w *WorkflowView) GetJobs() []*oapi.WorkflowJob {
	return w.workflowJobs
}

func (w *WorkflowView) GetJob(index int) *oapi.WorkflowJob {
	return w.workflowJobs[index]
}
