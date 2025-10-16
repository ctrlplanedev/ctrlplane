package deployments

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Deployments struct{}

func New() *Deployments {
	return &Deployments{}
}

func (s *Deployments) GetDeploymentResources(c *gin.Context, workspaceId string, deploymentId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	resources, err := ws.Deployments().Resources(deploymentId)
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
