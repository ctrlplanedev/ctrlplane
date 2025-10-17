package environments

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Environments struct{}

func (s *Environments) GetEnvironment(c *gin.Context, workspaceId string, environmentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	environment, ok := ws.Environments().Get(environmentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Environment not found",
		})
		return
	}

	c.JSON(http.StatusOK, environment)
}

func (s *Environments) GetEnvironmentResources(c *gin.Context, workspaceId string, environmentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resources, err := ws.Environments().Resources(environmentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resourceList := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceList = append(resourceList, resource)
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": resourceList,
	})
}
