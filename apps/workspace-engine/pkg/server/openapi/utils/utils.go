package utils

import (
	"fmt"
	"slices"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"

	"github.com/gin-gonic/gin"
)

func GetWorkspace(c *gin.Context, workspaceId string) (*workspace.Workspace, error) {
	dbWorkspaceIds, err := db.GetWorkspaceIDs(c.Request.Context())
	if err != nil {
		return nil, err
	}

	if !slices.Contains(dbWorkspaceIds, workspaceId) {
		return nil, fmt.Errorf("workspace %s not found in database", workspaceId)
	}

	wsExists := workspace.Exists(workspaceId)
	if wsExists {
		return workspace.GetWorkspace(workspaceId), nil
	}

	ws := workspace.New(workspaceId)
	if err := workspace.PopulateWorkspaceWithInitialState(c.Request.Context(), ws); err != nil {
		return nil, fmt.Errorf("failed to populate workspace with initial state: %w", err)
	}
	workspace.Set(workspaceId, ws)
	return ws, nil
}
