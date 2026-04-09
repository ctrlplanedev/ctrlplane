package deployments

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get deployment"})
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

	releaseTargets, err := queries.GetReleaseTargetsForDeployment(ctx, deploymentUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get release targets"})
		return
	}

	agentSet := make(map[string]oapi.JobAgent)

	for _, rt := range releaseTargets {
		resourceRow, err := queries.GetResourceByID(ctx, rt.ResourceID)
		if err != nil {
			continue
		}
		resource := db.ToOapiResource(resourceRow)

		agents, err := selector.MatchJobAgentsWithResource(
			ctx,
			deployment.JobAgentSelector,
			oapiAgents,
			resource,
		)
		if err != nil {
			c.JSON(
				http.StatusBadRequest,
				gin.H{"error": "Failed to evaluate selector: " + err.Error()},
			)
			return
		}

		for _, agent := range agents {
			agentSet[agent.Id] = agent
		}
	}

	matched := make([]oapi.JobAgent, 0, len(agentSet))
	for _, agent := range agentSet {
		matched = append(matched, agent)
	}

	c.JSON(http.StatusOK, gin.H{"items": matched})
}
