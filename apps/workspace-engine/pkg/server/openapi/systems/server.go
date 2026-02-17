package systems

import (
	"net/http"
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

	envIDs := ws.SystemEnvironments().GetEnvironmentIDsForSystem(systemId)
	environmentsList := make([]*oapi.Environment, 0, len(envIDs))
	for _, eid := range envIDs {
		if env, ok := ws.Environments().Get(eid); ok {
			environmentsList = append(environmentsList, env)
		}
	}

	depIDs := ws.SystemDeployments().GetDeploymentIDsForSystem(systemId)
	deploymentsList := make([]*oapi.Deployment, 0, len(depIDs))
	for _, did := range depIDs {
		if dep, ok := ws.Deployments().Get(did); ok {
			deploymentsList = append(deploymentsList, dep)
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
