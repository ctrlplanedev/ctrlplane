package events

import (
	"context"
	"fmt"

	"workspace-engine/pkg/logger"

	"github.com/charmbracelet/log"
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

type EventProcessor struct {
	handlers EventHandlerRegistry
	log      *log.Logger
}

func NewEventProcessor() *EventProcessor {
	return &EventProcessor{
		handlers: EventHandlerRegistry{
			ResourceCreated: handleResourceCreatedEvent,
			ResourceUpdated: handleResourceUpdatedEvent,
			ResourceDeleted: handleResourceDeletedEvent,
		},
		log: logger.Get(),
	}
}

func (p *EventProcessor) HandleEvent(ctx context.Context, event RawEvent) error {
	handler, ok := p.handlers[event.EventType]
	if !ok {
		return fmt.Errorf("no handler found for event type: %s", event.EventType)
	}

	return handler(ctx, event)
}
