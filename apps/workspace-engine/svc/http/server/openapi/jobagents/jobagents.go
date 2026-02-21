package jobagents

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/http/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type JobAgents struct{}

func (s *JobAgents) GetJobAgents(c *gin.Context, workspaceId string, params oapi.GetJobAgentsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(ws.JobAgents().Items())
	start := min(offset, total)
	end := min(start+limit, total)

	jobAgents := ws.JobAgents().Items()
	jobAgentsList := make([]*oapi.JobAgent, 0, len(jobAgents))
	for _, jobAgent := range jobAgents {
		jobAgentsList = append(jobAgentsList, jobAgent)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  jobAgentsList[start:end],
	})
}

func (s *JobAgents) GetJobAgent(c *gin.Context, workspaceId string, jobAgentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	jobAgent, ok := ws.JobAgents().Get(jobAgentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job agent not found",
		})
		return
	}

	c.JSON(http.StatusOK, jobAgent)
}

func (s *JobAgents) GetJobsForJobAgent(c *gin.Context, workspaceId string, jobAgentId string, params oapi.GetJobsForJobAgentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	jobs := ws.Jobs().Items()
	jobsList := make([]*oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		if job.JobAgentId == jobAgentId {
			jobsList = append(jobsList, job)
		}
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(jobsList)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  jobsList[start:end],
	})
}

func (s *JobAgents) GetDeploymentsForJobAgent(c *gin.Context, workspaceId string, jobAgentId string, params oapi.GetDeploymentsForJobAgentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	deployments := ws.Deployments().Items()
	deploymentsList := make([]*oapi.Deployment, 0, len(deployments))
	for _, deployment := range deployments {
		if deployment.JobAgentId != nil && *deployment.JobAgentId == jobAgentId {
			deploymentsList = append(deploymentsList, deployment)
		}
	}

	sort.Slice(deploymentsList, func(i, j int) bool {
		return deploymentsList[i].Name < deploymentsList[j].Name
	})

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(deploymentsList)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  deploymentsList[start:end],
	})
}
