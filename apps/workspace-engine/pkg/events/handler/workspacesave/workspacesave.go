package workspacesave

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/workspace"
)

func HandleWorkspaceSave(_ctx context.Context, _ws *workspace.Workspace, _event handler.RawEvent) error {
	return nil
}

func IsWorkspaceSaveEvent(msg *messaging.Message) bool {
	var rawEvent handler.RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		return false
	}

	return rawEvent.EventType == handler.WorkspaceSave
}
