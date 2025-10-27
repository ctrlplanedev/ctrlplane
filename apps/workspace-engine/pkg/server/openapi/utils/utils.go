package utils

import (
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"

	"github.com/gin-gonic/gin"
)

func GetWorkspace(c *gin.Context, workspaceId string) (*workspace.Workspace, error) {
	existsInDB, err := db.WorkspaceExists(c.Request.Context(), workspaceId)
	if err != nil {
		return nil, err
	}
	if !existsInDB {
		return nil, fmt.Errorf("workspace %s not found in database", workspaceId)
	}

	if exists, ok := manager.Workspaces().Get(workspaceId); ok {
		return exists, nil
	}

	return nil, fmt.Errorf("workspace %s not found", workspaceId)
}

