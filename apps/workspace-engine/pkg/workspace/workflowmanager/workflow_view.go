package workflowmanager

import (
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type WorkflowRunView struct {
	store           *store.Store
	workflowRun     *oapi.WorkflowRun
	workflowRunJobs []*oapi.WorkflowJob
	jobs            map[string][]*oapi.Job
}

func NewWorkflowRunView(store *store.Store, workflowRunId string) (*WorkflowRunView, error) {
	workflowRun, ok := store.WorkflowRuns.Get(workflowRunId)
	if !ok {
		return nil, fmt.Errorf("workflow run %s not found", workflowRunId)
	}
	workflowJobs := store.WorkflowJobs.GetByWorkflowRunId(workflowRunId)
	sort.Slice(workflowJobs, func(i, j int) bool {
		return workflowJobs[i].Index < workflowJobs[j].Index
	})

	jobs := make(map[string][]*oapi.Job)
	for _, wfJob := range workflowJobs {
		jobs[wfJob.Id] = store.Jobs.GetByWorkflowJobId(wfJob.Id)
	}

	return &WorkflowRunView{
		store:           store,
		workflowRun:     workflowRun,
		workflowRunJobs: workflowJobs,
		jobs:            jobs,
	}, nil
}

func (w *WorkflowRunView) IsComplete() bool {
	for _, wfJob := range w.workflowRunJobs {
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

func (w *WorkflowRunView) GetWorkflowRun() *oapi.WorkflowRun {
	return w.workflowRun
}

func (w *WorkflowRunView) GetJobs() []*oapi.WorkflowJob {
	return w.workflowRunJobs
}

func (w *WorkflowRunView) GetJob(index int) *oapi.WorkflowJob {
	return w.workflowRunJobs[index]
}
