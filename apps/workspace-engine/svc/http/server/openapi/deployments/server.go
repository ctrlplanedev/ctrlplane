package deployments

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
)

type Deployments struct{}

func (d *Deployments) GetJobAgentsForDeployment(c *gin.Context, deploymentId string) {
	ctx := c.Request.Context()
	queries := db.GetQueries(ctx)

	deploymentUUID, err := uuid.Parse(deploymentId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	deployment, err := queries.GetDeploymentByID(ctx, deploymentUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	allAgents, err := queries.ListJobAgentsByWorkspaceID(ctx, deployment.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list job agents"})
		return
	}

	oapiAgents := make([]oapi.JobAgent, len(allAgents))
	for i, row := range allAgents {
		oapiAgents[i] = *db.ToOapiJobAgent(row)
	}

	matched, err := selector.MatchJobAgents(ctx, deployment.JobAgentSelector, oapiAgents)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to evaluate selector: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": matched})
}
