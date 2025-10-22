package systems

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Systems struct{}

func (s *Systems) GetSystem(c *gin.Context, workspaceId string, systemId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	system, ok := ws.Systems().Get(systemId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "System not found",
		})
		return
	}

	environments := ws.Environments().Items()
	environmentsList := make([]*oapi.Environment, 0, len(environments))
	for _, environment := range environments {
		if environment.SystemId == systemId {
			environmentsList = append(environmentsList, environment)
		}
	}

	deployments := ws.Deployments().Items()
	deploymentsList := make([]*oapi.Deployment, 0, len(deployments))
	for _, deployment := range deployments {
		if deployment.SystemId == systemId {
			deploymentsList = append(deploymentsList, deployment)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"system":       system,
		"environments": environmentsList,
		"deployments":  deploymentsList,
	})
}
