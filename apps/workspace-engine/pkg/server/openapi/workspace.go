package openapi

import (
	"net/http"
	"workspace-engine/pkg/workspace/manager"

	"github.com/gin-gonic/gin"
)

// ListWorkspaceIds implements oapi.ServerInterface.
func (s *Server) ListWorkspaceIds(c *gin.Context) {
	workspaceIds := manager.Workspaces().Keys()
	c.JSON(http.StatusOK, gin.H{
		"workspaceIds": workspaceIds,
	})
}
