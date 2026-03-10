package utils

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
)

func GetWorkspace(c *gin.Context, workspaceId string) (*workspace.Workspace, error) {
	ctx := c.Request.Context()
	uuidWorkspaceId, err := uuid.Parse(workspaceId)
	if err != nil {
		return nil, err
	}

	existsInDB, err := db.
		GetQueries(ctx).
		WorkspaceExists(ctx, uuidWorkspaceId)
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
