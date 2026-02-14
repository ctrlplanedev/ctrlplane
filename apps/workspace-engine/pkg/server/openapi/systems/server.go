package systems

import (
	"net/http"
	"slices"
	"sort"
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
		if slices.Contains(environment.SystemIds, systemId) {
			environmentsList = append(environmentsList, environment)
		}
	}

	deployments := ws.Deployments().Items()
	deploymentsList := make([]*oapi.Deployment, 0, len(deployments))
	for _, deployment := range deployments {
		if slices.Contains(deployment.SystemIds, systemId) {
			deploymentsList = append(deploymentsList, deployment)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"system":       system,
		"environments": environmentsList,
		"deployments":  deploymentsList,
	})
}

func (s *Systems) ListSystems(c *gin.Context, workspaceId string, params oapi.ListSystemsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	systems := ws.Systems().Items()

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(systems)
	start := min(offset, total)
	end := min(start+limit, total)

	systemsList := make([]*oapi.System, 0, total)
	for _, system := range systems {
		systemsList = append(systemsList, system)
	}

	sort.Slice(systemsList, func(i, j int) bool {
		if systemsList[i] == nil && systemsList[j] == nil {
			return false
		}
		if systemsList[i] == nil {
			return false
		}
		if systemsList[j] == nil {
			return true
		}
		return systemsList[i].Name < systemsList[j].Name
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  systemsList[start:end],
	})
}
