package environments

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Environments struct{}

func New() *Environments {
	return &Environments{}
}

func (s *Environments) ListEnvironments(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	environments := ws.Environments()
	c.JSON(http.StatusOK, gin.H{
		"environments": environments,
	})
}

func (s *Environments) GetEnvironment(c *gin.Context, workspaceId string, environmentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
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
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	resources := ws.Environments().Resources(environmentId)

	resourceList := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceList = append(resourceList, resource)
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": resourceList,
	})
}
