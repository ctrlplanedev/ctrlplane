package environments

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Environments struct{}

func (s *Environments) GetEnvironmentResources(c *gin.Context, workspaceId string, environmentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
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
