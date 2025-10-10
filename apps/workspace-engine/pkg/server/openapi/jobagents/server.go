package jobagents

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type JobAgents struct{}

func New() *JobAgents {
	return &JobAgents{}
}

func (s *JobAgents) ListJobAgents(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	jobAgentsMap := ws.JobAgents().Items()
	jobAgentsList := make([]*oapi.JobAgent, 0, len(jobAgentsMap))
	for _, agent := range jobAgentsMap {
		jobAgentsList = append(jobAgentsList, agent)
	}
	c.JSON(http.StatusOK, gin.H{
		"jobAgents": jobAgentsList,
	})
}

func (s *JobAgents) GetJobAgent(c *gin.Context, workspaceId string, jobAgentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
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
