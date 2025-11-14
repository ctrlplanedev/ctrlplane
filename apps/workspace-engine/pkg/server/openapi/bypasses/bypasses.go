package bypasses

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"

	"github.com/gin-gonic/gin"
)

type Bypasses struct{}

func New() *Bypasses {
	return &Bypasses{}
}

// ListBypasses returns all policy bypasses for a workspace
// GET /v1/workspaces/{workspaceId}/bypasses
func (b *Bypasses) ListBypasses(c *gin.Context, workspaceId string) {
	ws, err := getWorkspaceForRequest(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	bypasses := make([]*oapi.PolicyBypass, 0)
	for _, bypass := range ws.Store().PolicyBypasses.Items() {
		bypasses = append(bypasses, bypass)
	}

	c.JSON(http.StatusOK, gin.H{
		"bypasses": bypasses,
	})
}

// GetBypass returns a specific policy bypass by ID
// GET /v1/workspaces/{workspaceId}/bypasses/{bypassId}
func (b *Bypasses) GetBypass(c *gin.Context, workspaceId string, bypassId string) {
	ws, err := getWorkspaceForRequest(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	bypass, ok := ws.Store().PolicyBypasses.Get(bypassId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Policy bypass not found",
		})
		return
	}

	c.JSON(http.StatusOK, bypass)
}

// getWorkspaceForRequest retrieves a workspace, with fallback for test environments
func getWorkspaceForRequest(c *gin.Context, workspaceId string) (*workspace.Workspace, error) {
	// Try utils.GetWorkspace first (production path with DB check)
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err == nil {
		return ws, nil
	}

	// Fallback: try manager directly (for test environments without DB)
	if ws, ok := manager.Workspaces().Get(workspaceId); ok {
		return ws, nil
	}

	return nil, err
}
