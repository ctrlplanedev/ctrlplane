package workflows

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"

	"github.com/gin-gonic/gin"
)

type Workflows struct{}

func (w *Workflows) ListWorkflows(c *gin.Context, workspaceId string, params oapi.ListWorkflowsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflows := ws.Workflows().Items()
	workflowItems := make([]*oapi.Workflow, 0, len(workflows))
	for _, workflow := range workflows {
		workflowItems = append(workflowItems, workflow)
	}
	sort.Slice(workflowItems, func(i, j int) bool {
		return workflowItems[i].Name < workflowItems[j].Name
	})

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	total := len(workflowItems)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  workflowItems[start:end],
	})
}

func (w *Workflows) GetWorkflow(c *gin.Context, workspaceId string, workflowId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflow, ok := ws.Workflows().Get(workflowId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Workflow not found",
		})
		return
	}

	c.JSON(http.StatusOK, *workflow)
}

func getWorkflowJobWithJobs(ws *workspace.Workspace, workflowJob *oapi.WorkflowJob) *oapi.WorkflowJobWithJobs {
	jobs := ws.Jobs().GetByWorkflowJobId(workflowJob.Id)
	jobsSlice := make([]oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		jobsSlice = append(jobsSlice, *job)
	}
	sort.Slice(jobsSlice, func(i, j int) bool {
		return jobsSlice[i].CreatedAt.Before(jobsSlice[j].CreatedAt)
	})
	workflowJobWithJobs := &oapi.WorkflowJobWithJobs{
		Id:     workflowJob.Id,
		Index:  workflowJob.Index,
		Ref:    workflowJob.Ref,
		Config: workflowJob.Config,
		Jobs:   jobsSlice,
	}
	return workflowJobWithJobs
}

func (w *Workflows) GetWorkflowRuns(c *gin.Context, workspaceId string, workflowId string, params oapi.GetWorkflowRunsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflowRuns := ws.WorkflowRuns().GetByWorkflowId(workflowId)

	workflowRunsSlice := make([]*oapi.WorkflowRun, 0, len(workflowRuns))
	for _, workflowRun := range workflowRuns {
		workflowRunsSlice = append(workflowRunsSlice, workflowRun)
	}

	workflowsWithWfJobs := make([]*oapi.WorkflowRunWithJobs, 0, len(workflowRunsSlice))
	for _, workflowRun := range workflowRunsSlice {
		workflowJobs := ws.WorkflowJobs().GetByWorkflowRunId(workflowRun.Id)
		workflowJobWithJobsSlice := make([]oapi.WorkflowJobWithJobs, 0, len(workflowJobs))
		for _, workflowJob := range workflowJobs {
			workflowJobWithJobsSlice = append(workflowJobWithJobsSlice, *getWorkflowJobWithJobs(ws, workflowJob))
		}
		sort.Slice(workflowJobWithJobsSlice, func(i, j int) bool {
			return workflowJobWithJobsSlice[i].Index < workflowJobWithJobsSlice[j].Index
		})
		workflowRunWithJobs := &oapi.WorkflowRunWithJobs{
			Id:         workflowRun.Id,
			WorkflowId: workflowRun.WorkflowId,
			Inputs:     workflowRun.Inputs,
			Jobs:       workflowJobWithJobsSlice,
		}
		workflowsWithWfJobs = append(workflowsWithWfJobs, workflowRunWithJobs)
	}

	sort.Slice(workflowsWithWfJobs, func(i, j int) bool {
		a := workflowsWithWfJobs[i]
		b := workflowsWithWfJobs[j]

		var earliestJobA *oapi.Job
		var earliestJobB *oapi.Job

		for _, workkflowJobWithJobs := range a.Jobs {
			for _, job := range workkflowJobWithJobs.Jobs {
				if earliestJobA == nil || job.CreatedAt.Before(earliestJobA.CreatedAt) {
					earliestJobA = &job
				}
			}
		}

		for _, workkflowJobWithJobs := range b.Jobs {
			for _, job := range workkflowJobWithJobs.Jobs {
				if earliestJobB == nil || job.CreatedAt.Before(earliestJobB.CreatedAt) {
					earliestJobB = &job
				}
			}
		}

		if earliestJobA == nil && earliestJobB == nil {
			return false
		}
		if earliestJobA == nil {
			return false
		}
		if earliestJobB == nil {
			return true
		}
		return earliestJobA.CreatedAt.Before(earliestJobB.CreatedAt)
	})

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	total := len(workflowsWithWfJobs)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  workflowsWithWfJobs[start:end],
	})
}
