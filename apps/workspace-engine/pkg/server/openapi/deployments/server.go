package deployments

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Deployments struct{}

func (s *Deployments) GetDeployment(c *gin.Context, workspaceId string, deploymentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	deployment, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

func (s *Deployments) GetDeploymentResources(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetDeploymentResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
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

	// Get pagination parameters with defaults
	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(resourceList)
	
	// Apply pagination
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}
	paginatedResources := resourceList[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}
