package openapi

import (
	"net/http"
	"workspace-engine/pkg/workspace/manager"
	"workspace-engine/pkg/workspace/status"

	"github.com/gin-gonic/gin"
)

// ListWorkspaceIds implements oapi.ServerInterface.
func (s *Server) ListWorkspaceIds(c *gin.Context) {
	workspaceIds := manager.Workspaces().Keys()
	c.JSON(http.StatusOK, gin.H{
		"workspaceIds": workspaceIds,
	})
}

// GetEngineStatus returns the current status of a workspace
func (s *Server) GetEngineStatus(c *gin.Context, workspaceId string) {
	statusSnapshot, exists := manager.StatusTracker().GetSnapshot(workspaceId)

	if !exists {
		// Workspace not tracked - check if it exists in memory
		_, loaded := manager.Workspaces().Get(workspaceId)
		if loaded {
			// Workspace exists but no status tracked - assume ready
			c.JSON(http.StatusOK, gin.H{
				"workspaceId": workspaceId,
				"state":       string(status.StateReady),
				"healthy":     true,
				"message":     "Workspace is loaded and operational",
			})
			return
		}

		// Workspace doesn't exist
		c.JSON(http.StatusNotFound, gin.H{
			"workspaceId": workspaceId,
			"state":       string(status.StateUnknown),
			"healthy":     false,
			"message":     "Workspace not found",
		})
		return
	}

	// Return full status information
	healthy := statusSnapshot.State == status.StateReady

	response := gin.H{
		"workspaceId":  statusSnapshot.WorkspaceID,
		"state":        string(statusSnapshot.State),
		"healthy":      healthy,
		"message":      statusSnapshot.Message,
		"stateEntered": statusSnapshot.StateEntered,
		"lastUpdated":  statusSnapshot.LastUpdated,
		"timeInState":  statusSnapshot.TimeInCurrentState().String(),
	}

	// Add error message if present
	if statusSnapshot.ErrorMessage != "" {
		response["errorMessage"] = statusSnapshot.ErrorMessage
	}

	// Add metadata if present
	if len(statusSnapshot.Metadata) > 0 {
		response["metadata"] = statusSnapshot.Metadata
	}

	// Add recent state history (last 5 transitions)
	if len(statusSnapshot.StateHistory) > 0 {
		historyLimit := 5
		if len(statusSnapshot.StateHistory) < historyLimit {
			historyLimit = len(statusSnapshot.StateHistory)
		}
		response["recentHistory"] = statusSnapshot.StateHistory[len(statusSnapshot.StateHistory)-historyLimit:]
	}

	statusCode := http.StatusOK
	if statusSnapshot.State == status.StateError {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// ListWorkspaceStatuses returns status for all workspaces
func (s *Server) ListWorkspaceStatuses(c *gin.Context) {
	statuses := manager.StatusTracker().ListAll()

	// Get state counts
	stateCounts := manager.StatusTracker().CountByState()

	c.JSON(http.StatusOK, gin.H{
		"workspaces":  statuses,
		"totalCount":  len(statuses),
		"stateCounts": stateCounts,
	})
}
