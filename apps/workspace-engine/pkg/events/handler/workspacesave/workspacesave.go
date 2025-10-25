package workspacesave

import (
	"context"
	"encoding/json"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/workspace"
)

func SendWorkspaceSave(ctx context.Context, producer messaging.Producer, wsId string) error {
	event := map[string]any{
		"eventType":   handler.WorkspaceSave,
		"workspaceId": wsId,
		"timestamp":   time.Now().Unix(),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return producer.Publish([]byte(wsId), eventBytes)
}

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
