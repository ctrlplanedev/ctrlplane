package policyskips

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"

	"github.com/gin-gonic/gin"
)

type PolicySkips struct{}

func New() *PolicySkips {
	return &PolicySkips{}
}

// ListPolicySkips returns all policy skips for a workspace
// GET /v1/workspaces/{workspaceId}/skips
func (p *PolicySkips) ListPolicySkips(c *gin.Context, workspaceId string) {
	ws, err := getWorkspaceForRequest(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	skips := make([]*oapi.PolicySkip, 0)
	for _, skip := range ws.Store().PolicySkips.Items() {
		skips = append(skips, skip)
	}

	c.JSON(http.StatusOK, gin.H{
		"skips": skips,
	})
}

// GetPolicySkip returns a specific policy skip by ID
// GET /v1/workspaces/{workspaceId}/skips/{skipId}
func (p *PolicySkips) GetPolicySkip(c *gin.Context, workspaceId string, bypassId string) {
	ws, err := getWorkspaceForRequest(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	bypass, ok := ws.Store().PolicySkips.Get(bypassId)
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
