package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("events/handler")

// EventType represents the type of event being handled
type EventType string

const (
	ResourceCreate EventType = "resource.created"
	ResourceUpdate EventType = "resource.updated"
	ResourceDelete EventType = "resource.deleted"

	DeploymentCreate EventType = "deployment.created"
	DeploymentUpdate EventType = "deployment.updated"
	DeploymentDelete EventType = "deployment.deleted"

	DeploymentVersionCreate EventType = "deployment-version.created"
	DeploymentVersionUpdate EventType = "deployment-version.updated"
	DeploymentVersionDelete EventType = "deployment-version.deleted"

	EnvironmentCreate EventType = "environment.created"
	EnvironmentUpdate EventType = "environment.updated"
	EnvironmentDelete EventType = "environment.deleted"

	SystemCreate EventType = "system.created"
	SystemUpdate EventType = "system.updated"
	SystemDelete EventType = "system.deleted"

	JobAgentCreate EventType = "job-agent.created"
	JobAgentUpdate EventType = "job-agent.updated"
	JobAgentDelete EventType = "job-agent.deleted"

	JobUpdate EventType = "job.updated"

	PolicyCreate EventType = "policy.created"
	PolicyUpdate EventType = "policy.updated"
	PolicyDelete EventType = "policy.deleted"

	UserApprovalRecordCreate EventType = "user-approval-record.created"
	UserApprovalRecordUpdate EventType = "user-approval-record.updated"
	UserApprovalRecordDelete EventType = "user-approval-record.deleted"
)

// BaseEvent represents the common structure of all events
type BaseEvent struct {
	EventType   EventType `json:"eventType"`
	WorkspaceID string    `json:"workspaceId"`
}

// RawEvent represents the raw event data received from Kafka messages
type RawEvent struct {
	BaseEvent
	Data json.RawMessage `json:"data,omitempty"`
}

// Handler defines the interface for processing events
type Handler func(ctx context.Context, workspace *workspace.Workspace, event RawEvent) error

// HandlerRegistry maps event types to their corresponding handlers
type HandlerRegistry map[EventType]Handler

// EventListener listens for events on the queue and routes them to appropriate handlers
type EventListener struct {
	handlers HandlerRegistry
}

// NewEventListener creates a new event listener with the provided handlers
func NewEventListener(handlers HandlerRegistry) *EventListener {
	return &EventListener{handlers: handlers}
}

// ListenAndRoute processes incoming Kafka messages and routes them to the appropriate handler
func (el *EventListener) ListenAndRoute(ctx context.Context, msg *kafka.Message) error {
	ctx, span := tracer.Start(ctx, "ListenAndRoute",
		trace.WithAttributes(
			attribute.String("kafka.topic", *msg.TopicPartition.Topic),
			attribute.Int("kafka.partition", int(msg.TopicPartition.Partition)),
			attribute.Int64("kafka.offset", int64(msg.TopicPartition.Offset)),
		))
	defer span.End()

	// Parse the raw event from the Kafka message
	var rawEvent RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to unmarshal event")
		log.Error("Failed to unmarshal event", "error", err, "message", string(msg.Value))
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Add event metadata to span
	span.SetAttributes(
		attribute.String("event.type", string(rawEvent.EventType)),
		attribute.String("event.key", string(msg.Key)),
		attribute.String("event.workspace_id", rawEvent.WorkspaceID),
		attribute.Float64("event.timestamp", float64(msg.Timestamp.Unix())),
	)

	// Find the appropriate handler for this event type
	handler, ok := el.handlers[rawEvent.EventType]
	if !ok {
		err := fmt.Errorf("no handler found for event type: %s", rawEvent.EventType)
		span.RecordError(err)
		span.SetStatus(codes.Error, "no handler found")
		log.Warn("No handler found for event type", "eventType", rawEvent.EventType)
		return err
	}

	// Execute the handler
	startTime := time.Now()
	var ws *workspace.Workspace

	wsExists := workspace.Exists(rawEvent.WorkspaceID)
	if wsExists {
		ws = workspace.GetWorkspace(rawEvent.WorkspaceID)
	}
	if !wsExists {
		fullWs, err := db.LoadWorkspace(ctx, rawEvent.WorkspaceID)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to load workspace")
			log.Error("Failed to load workspace", "error", err, "workspaceID", rawEvent.WorkspaceID)
			return fmt.Errorf("failed to load workspace: %w", err)
		}
		workspace.Set(rawEvent.WorkspaceID, fullWs)
		ws = fullWs
	}

	err := handler(ctx, ws, rawEvent)

	// Always run a dispatch eval jobs
	changes := ws.ReleaseManager().Reconcile(ctx)
	_ = ws.ReleaseManager().EvaluateChange(ctx, changes)

	duration := time.Since(startTime)

	span.SetAttributes(attribute.Int("release-target.added", len(changes.Changes.Added)))
	span.SetAttributes(attribute.Int("release-target.removed", len(changes.Changes.Removed)))
	span.SetAttributes(attribute.Int64("event.processing_duration_ms", duration.Milliseconds()))

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "handler failed")
		log.Error("Handler failed to process event",
			"eventType", rawEvent.EventType,
			"error", err,
			"duration", duration)
		return fmt.Errorf("handler failed to process event %s: %w", rawEvent.EventType, err)
	}

	span.SetStatus(codes.Ok, "event processed successfully")
	log.Debug("Successfully processed event",
		"eventType", rawEvent.EventType,
		"duration", duration)

	return nil
}
