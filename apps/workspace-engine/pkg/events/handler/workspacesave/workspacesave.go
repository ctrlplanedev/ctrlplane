package workspacesave

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/workspace"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func HandleWorkspaceSave(_ctx context.Context, _ws *workspace.Workspace, _event handler.RawEvent) error {
	return nil
}

func IsWorkspaceSaveEvent(msg *kafka.Message) bool {
	var rawEvent handler.RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		return false
	}

	return rawEvent.EventType == handler.WorkspaceSave
}
