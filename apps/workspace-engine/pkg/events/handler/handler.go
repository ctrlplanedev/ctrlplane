package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/logger"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// EventType represents the type of event being handled
type EventType string

const (
	ResourceCreated EventType = "resource.created"
	ResourceUpdated EventType = "resource.updated"
	ResourceDeleted EventType = "resource.deleted"
)

// BaseEvent represents the common structure of all events
type BaseEvent struct {
	EventType   EventType `json:"eventType"`
	WorkspaceID string    `json:"workspaceId"`
	EventID     string    `json:"eventId"`
	Timestamp   float64   `json:"timestamp"`
	Source      string    `json:"source"`
}

// RawEvent represents the raw event data received from Kafka messages
type RawEvent struct {
	BaseEvent
	Data json.RawMessage `json:"data,omitempty"`
}

// Handler defines the interface for processing events
type Handler interface {
	Handle(ctx context.Context, event RawEvent) error
}

// HandlerRegistry maps event types to their corresponding handlers
type HandlerRegistry map[EventType]Handler

// EventListener listens for events on the queue and routes them to appropriate handlers
type EventListener struct {
	handlers HandlerRegistry
	log      *log.Logger
}

// NewEventListener creates a new event listener with the provided handlers
func NewEventListener(handlers HandlerRegistry) *EventListener {
	return &EventListener{
		handlers: handlers,
		log:      logger.Get(),
	}
}

// ListenAndRoute processes incoming Kafka messages and routes them to the appropriate handler
func (el *EventListener) ListenAndRoute(ctx context.Context, msg *kafka.Message) error {
	el.log.Debug("Processing message", "topic", *msg.TopicPartition.Topic, "partition", msg.TopicPartition.Partition, "offset", msg.TopicPartition.Offset)

	// Parse the raw event from the Kafka message
	var rawEvent RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		el.log.Error("Failed to unmarshal event", "error", err, "message", string(msg.Value))
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	el.log.Info("Received event", "eventType", rawEvent.EventType, "eventId", rawEvent.EventID, "workspaceId", rawEvent.WorkspaceID)

	// Find the appropriate handler for this event type
	handler, ok := el.handlers[rawEvent.EventType]
	if !ok {
		el.log.Warn("No handler found for event type", "eventType", rawEvent.EventType)
		return fmt.Errorf("no handler found for event type: %s", rawEvent.EventType)
	}

	// Execute the handler
	startTime := time.Now()
	err := handler.Handle(ctx, rawEvent)
	duration := time.Since(startTime)

	if err != nil {
		el.log.Error("Handler failed to process event", 
			"eventType", rawEvent.EventType, 
			"eventId", rawEvent.EventID, 
			"error", err,
			"duration", duration)
		return fmt.Errorf("handler failed to process event %s: %w", rawEvent.EventType, err)
	}

	el.log.Info("Successfully processed event", 
		"eventType", rawEvent.EventType, 
		"eventId", rawEvent.EventID,
		"duration", duration)

	return nil
}
