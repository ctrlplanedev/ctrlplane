package utils

import (
	"net/http"
	"workspace-engine/pkg/workspace"

	"github.com/gin-gonic/gin"
)

func GetWorkspace(c *gin.Context, workspaceId string) *workspace.Workspace {
	ok := workspace.HasWorkspace(workspaceId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Workspace not found",
		})
		return nil
	}

	return workspace.GetWorkspace(workspaceId)
}
