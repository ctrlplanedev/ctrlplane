package events

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/logger"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type EventType string

const (
	ResourceCreated EventType = "resource.created"
	ResourceUpdated EventType = "resource.updated"
	ResourceDeleted EventType = "resource.deleted"
)

type BaseEvent struct {
	EventType   EventType `json:"eventType"`
	WorkspaceID string    `json:"workspaceId"`
	EventID     string    `json:"eventId"`
	Timestamp   float64   `json:"timestamp"`
	Source      string    `json:"source"`
}

type RawEvent struct {
	BaseEvent
	Payload any `json:"payload,omitempty"`
}

type EventHandler func(ctx context.Context, event RawEvent) error
type EventHandlerRegistry map[EventType]EventHandler

type MessageReader struct {
	handlers EventHandlerRegistry
	log      *log.Logger
}

func NewMessageReader() *MessageReader {
	return &MessageReader{
		handlers: EventHandlerRegistry{
			ResourceCreated: handleResourceCreatedEvent,
			ResourceUpdated: handleResourceUpdatedEvent,
			ResourceDeleted: handleResourceDeletedEvent,
		},
		log: logger.Get(),
	}
}

func (p *MessageReader) ReadMessage(ctx context.Context, msg *kafka.Message) error {
	var rawEvent RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	handler, ok := p.handlers[rawEvent.EventType]
	if !ok {
		return fmt.Errorf("no handler found for event type: %s", rawEvent.EventType)
	}

	return handler(ctx, rawEvent)
}
