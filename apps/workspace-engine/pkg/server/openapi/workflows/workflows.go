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

func (w *Workflows) GetWorkflowTemplates(c *gin.Context, workspaceId string, params oapi.GetWorkflowTemplatesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflowTemplates := ws.WorkflowTemplates().Items()
	workflowTemplateItems := make([]*oapi.WorkflowTemplate, 0, len(workflowTemplates))
	for _, workflowTemplate := range workflowTemplates {
		workflowTemplateItems = append(workflowTemplateItems, workflowTemplate)
	}
	sort.Slice(workflowTemplateItems, func(i, j int) bool {
		return workflowTemplateItems[i].Name < workflowTemplateItems[j].Name
	})

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	total := len(workflowTemplateItems)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  workflowTemplateItems[start:end],
	})
}

func (w *Workflows) GetWorkflowTemplate(c *gin.Context, workspaceId string, workflowTemplateId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflowTemplate, ok := ws.WorkflowTemplates().Get(workflowTemplateId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Workflow template not found",
		})
		return
	}

	c.JSON(http.StatusOK, *workflowTemplate)
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

func (w *Workflows) GetWorkflowsByTemplate(c *gin.Context, workspaceId string, workflowTemplateId string, params oapi.GetWorkflowsByTemplateParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflows := ws.Workflows().GetByTemplateID(workflowTemplateId)

	workflowsSlice := make([]*oapi.Workflow, 0, len(workflows))
	for _, workflow := range workflows {
		workflowsSlice = append(workflowsSlice, workflow)
	}

	workflowsWithWfJobs := make([]*oapi.WorkflowWithJobs, 0, len(workflowsSlice))
	for _, workflow := range workflowsSlice {
		workflowJobs := ws.WorkflowJobs().GetByWorkflowId(workflow.Id)
		workflowJobWithJobsSlice := make([]oapi.WorkflowJobWithJobs, 0, len(workflowJobs))
		for _, workflowJob := range workflowJobs {
			workflowJobWithJobsSlice = append(workflowJobWithJobsSlice, *getWorkflowJobWithJobs(ws, workflowJob))
		}
		sort.Slice(workflowJobWithJobsSlice, func(i, j int) bool {
			return workflowJobWithJobsSlice[i].Index < workflowJobWithJobsSlice[j].Index
		})
		workflowWithJobs := &oapi.WorkflowWithJobs{
			Id:                 workflow.Id,
			WorkflowTemplateId: workflow.WorkflowTemplateId,
			Inputs:             workflow.Inputs,
			Jobs:               workflowJobWithJobsSlice,
		}
		workflowsWithWfJobs = append(workflowsWithWfJobs, workflowWithJobs)
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
