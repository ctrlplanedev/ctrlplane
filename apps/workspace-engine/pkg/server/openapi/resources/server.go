package resources

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Resources struct{}

func New() *Resources {
	return &Resources{}
}

func (s *Resources) ListResources(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	resources := ws.Resources()
	c.JSON(http.StatusOK, gin.H{
		"resources": resources,
	})
}

func (s *Resources) GetResource(c *gin.Context, workspaceId string, resourceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	resource, ok := ws.Resources().Get(resourceId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	c.JSON(http.StatusOK, resource)
}

func (s *Resources) ListResourceVariables(c *gin.Context, workspaceId string, resourceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	_, ok := ws.Resources().Get(resourceId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	variables := ws.Resources().Variables(resourceId)
	variableList := make([]*oapi.ResourceVariable, 0, len(variables))
	for _, v := range variables {
		variableList = append(variableList, v)
	}
	c.JSON(http.StatusOK, gin.H{
		"variables": variableList,
	})
}
