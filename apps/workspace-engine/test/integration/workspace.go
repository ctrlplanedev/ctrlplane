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
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type TestWorkspace struct {
	t         *testing.T
	workspace *workspace.Workspace

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
	ws := workspace.GetWorkspace(workspaceID)

	tw := &TestWorkspace{}
	tw.t = t
	tw.workspace = ws
	tw.eventListener = events.NewEventHandler()

	for _, option := range options {
		option(tw)
	}

	return tw
}

func (tw *TestWorkspace) With(options ...WorkspaceOption) *TestWorkspace {
	for _, option := range options {
		option(tw)
	}
	return tw
}

func (tw *TestWorkspace) Workspace() *workspace.Workspace {
	return tw.workspace
}

// PushEvent sends an event through the event listener
func (tw *TestWorkspace) PushEvent(ctx context.Context, eventType handler.EventType, data any) *TestWorkspace {
	tw.t.Helper()

	// Marshal the data payload
	var dataBytes []byte
	var err error

	// Check if data is a protobuf message
	if protoMsg, ok := data.(proto.Message); ok {
		dataBytes, err = protojson.Marshal(protoMsg)
	} else {
		dataBytes, err = json.Marshal(data)
	}

	if err != nil {
		tw.t.Fatalf("failed to marshal event data: %v", err)
		return tw
	}

	// Create raw event
	rawEvent := handler.RawEvent{
		EventType:   eventType,
		WorkspaceID: tw.workspace.ID,
		Data: dataBytes,
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
	offset := kafka.Offset(0)

	msg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: partition,
			Offset:    offset,
		},
		Value: eventBytes,
	}

	if err := tw.eventListener.ListenAndRoute(ctx, msg); err != nil {
		tw.t.Fatalf("failed to listen and route event: %v", err)
	}

	return tw
}
