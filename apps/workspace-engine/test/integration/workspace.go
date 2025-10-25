package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
)

func init() {
	manager.Configure(
		manager.WithPersistentStore(memory.NewStore()),
		manager.WithWorkspaceCreateOptions(
			workspace.AddDefaultSystem(),
		),
	)
}

type TestWorkspace struct {
	t             *testing.T
	workspace     *workspace.Workspace
	eventListener *handler.EventListener
}

func NewTestWorkspace(
	t *testing.T,
	options ...WorkspaceOption,
) *TestWorkspace {
	if t == nil {
		t = &testing.T{}
	}
	t.Helper()

	workspaceID := fmt.Sprintf("test-workspace-%d", time.Now().UnixNano())
	ws, err := manager.GetOrLoad(context.Background(), workspaceID)
	if err != nil {
		t.Fatalf("failed to get or create workspace: %v", err)
	}

	tw := &TestWorkspace{}
	tw.t = t
	tw.workspace = ws
	tw.eventListener = events.NewEventHandler()

	for _, option := range options {
		if err := option(tw); err != nil {
			tw.t.Fatalf("failed to apply option: %v", err)
		}
	}

	return tw
}

func (tw *TestWorkspace) Workspace() *workspace.Workspace {
	return tw.workspace
}

// PushEvent sends an event through the event listener
// In persistence mode, it automatically saves and reloads state after processing
func (tw *TestWorkspace) PushEvent(ctx context.Context, eventType handler.EventType, data any) *TestWorkspace {
	tw.t.Helper()

	dataBytes, err := json.Marshal(data)
	if err != nil {
		tw.t.Fatalf("failed to marshal event data: %v", err)
		return tw
	}

	// Create raw event
	rawEvent := handler.RawEvent{
		EventType:   eventType,
		WorkspaceID: tw.workspace.ID,
		Data:        dataBytes,
	}

	// Marshal the full event
	eventBytes, err := json.Marshal(rawEvent)
	if err != nil {
		tw.t.Fatalf("failed to marshal raw event: %v", err)
		return tw
	}

	// Create a mock Kafka message
	topic := "test-topic"
	partition := int32(0)

	msg := &messaging.Message{
		Key:       []byte(topic),
		Value:     eventBytes,
		Partition: partition,
		Offset:    int64(1),
	}

	if _, err := tw.eventListener.ListenAndRoute(ctx, msg); err != nil {
		tw.t.Fatalf("failed to listen and route event: %v", err)
	}

	return tw
}
