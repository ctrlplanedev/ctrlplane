package resources

import (
	"net/http"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Resources struct{}

func (r *Resources) GetResourceByIdentifier(c *gin.Context, workspaceId string, resourceIdentifier string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	// Iterate through resources to find by identifier
	resources := ws.Resources().Items()
	for _, resource := range resources {
		if resource.Identifier == resourceIdentifier {
			c.JSON(http.StatusOK, resource)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Resource not found",
	})
}

