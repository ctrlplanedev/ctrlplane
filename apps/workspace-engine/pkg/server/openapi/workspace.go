package openapi

import (
	"net/http"
	"workspace-engine/pkg/workspace/registry"

	"github.com/gin-gonic/gin"
)

// ListWorkspaceIds implements oapi.ServerInterface.
func (s *Server) ListWorkspaceIds(c *gin.Context) {
	workspaceIds := registry.Workspaces.Keys()
	c.JSON(http.StatusOK, gin.H{
		"workspaceIds": workspaceIds,
	})
}
