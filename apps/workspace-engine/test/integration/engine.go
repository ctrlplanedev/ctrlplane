package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/workspace"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// TestEngine provides utilities for event-based e2e testing
type TestEngine struct {
	t             *testing.T
	workspace     *workspace.Workspace
	eventListener *handler.EventListener
	workspaceID   string
}

// NewTestEngine creates a new test engine with workspace and event listener
func NewTestEngine(t *testing.T) *TestEngine {
	if t == nil {
		t = &testing.T{}
	}
	t.Helper()

	workspaceID := fmt.Sprintf("test-workspace-%d", time.Now().UnixNano())
	ws := workspace.GetWorkspace(workspaceID)
	eventListener := events.NewEventHandler()

	return &TestEngine{
		t:             t,
		workspace:     ws,
		eventListener: eventListener,
		workspaceID:   workspaceID,
	}
}

func (th *TestEngine) Workspace() *workspace.Workspace {
	return th.workspace
}

// PushEvent sends an event through the event listener
func (th *TestEngine) PushEvent(ctx context.Context, eventType handler.EventType, data any) error {
	th.t.Helper()

	// Marshal the data payload
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	// Create raw event
	rawEvent := handler.RawEvent{
		BaseEvent: handler.BaseEvent{
			EventType:   eventType,
			WorkspaceID: th.workspaceID,
		},
		Data: dataBytes,
	}

	// Marshal the full event
	eventBytes, err := json.Marshal(rawEvent)
	if err != nil {
		return fmt.Errorf("failed to marshal raw event: %w", err)
	}

	// Create a mock Kafka message
	topic := "test-topic"
	partition := int32(0)
	offset := kafka.Offset(0)

	msg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: partition,
			Offset:    offset,
		},
		Value: eventBytes,
	}

	// Process the event through the listener
	return th.eventListener.ListenAndRoute(ctx, msg)
}
