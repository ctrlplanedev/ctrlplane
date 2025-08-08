package engine

import (
	"workspace-engine/pkg/engine/workspace"

	"github.com/charmbracelet/log"
)

var workspaces = make(map[string]*workspace.WorkspaceEngine)

func GetWorkspaceEngine(workspaceID string) *workspace.WorkspaceEngine {
	engine, ok := workspaces[workspaceID]
	if !ok {
		engine = workspace.NewWorkspaceEngine(workspaceID)
		log.Warn("Creating new workspace engine.", "workspaceID", workspaceID)
		workspaces[workspaceID] = engine
	}
	return engine
}
