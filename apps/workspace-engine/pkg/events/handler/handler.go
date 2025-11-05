package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"

	"github.com/charmbracelet/log"
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

	ResourceVariableCreate EventType = "resource-variable.created"
	ResourceVariableUpdate EventType = "resource-variable.updated"
	ResourceVariableDelete EventType = "resource-variable.deleted"

	ResourceProviderCreate       EventType = "resource-provider.created"
	ResourceProviderUpdate       EventType = "resource-provider.updated"
	ResourceProviderDelete       EventType = "resource-provider.deleted"
	ResourceProviderSetResources EventType = "resource-provider.set-resources"

	DeploymentCreate EventType = "deployment.created"
	DeploymentUpdate EventType = "deployment.updated"
	DeploymentDelete EventType = "deployment.deleted"

	DeploymentVersionCreate EventType = "deployment-version.created"
	DeploymentVersionUpdate EventType = "deployment-version.updated"
	DeploymentVersionDelete EventType = "deployment-version.deleted"

	DeploymentVariableCreate EventType = "deployment-variable.created"
	DeploymentVariableUpdate EventType = "deployment-variable.updated"
	DeploymentVariableDelete EventType = "deployment-variable.deleted"

	DeploymentVariableValueCreate EventType = "deployment-variable-value.created"
	DeploymentVariableValueUpdate EventType = "deployment-variable-value.updated"
	DeploymentVariableValueDelete EventType = "deployment-variable-value.deleted"

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

	RelationshipRuleCreate EventType = "relationship-rule.created"
	RelationshipRuleUpdate EventType = "relationship-rule.updated"
	RelationshipRuleDelete EventType = "relationship-rule.deleted"

	UserApprovalRecordCreate EventType = "user-approval-record.created"
	UserApprovalRecordUpdate EventType = "user-approval-record.updated"
	UserApprovalRecordDelete EventType = "user-approval-record.deleted"

	GithubEntityCreate EventType = "github-entity.created"
	GithubEntityUpdate EventType = "github-entity.updated"
	GithubEntityDelete EventType = "github-entity.deleted"

	WorkspaceTick EventType = "workspace.tick"
	WorkspaceSave EventType = "workspace.save"

	ReleaseTargetDeploy EventType = "release-target.deploy"
)

// RawEvent represents the raw event data received from Kafka messages
type RawEvent struct {
	EventType   EventType       `json:"eventType"`
	WorkspaceID string          `json:"workspaceId"`
	Data        json.RawMessage `json:"data,omitempty"`
	Timestamp   int64           `json:"timestamp"`
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
	el := &EventListener{handlers: handlers}
	return el
}

type OffsetTracker struct {
	LastCommittedOffset int64
	LastWorkspaceOffset int64
	MessageOffset       int64
}

// ListenAndRoute processes incoming Kafka messages and routes them to the appropriate handler
func (el *EventListener) ListenAndRoute(ctx context.Context, msg *messaging.Message) (*workspace.Workspace, error) {
	ctx, span := tracer.Start(ctx, "ListenAndRoute",
		trace.WithAttributes(
			attribute.Int("kafka.partition", int(msg.Partition)),
			attribute.Int64("kafka.offset", msg.Offset),
			attribute.String("event.data", string(msg.Value)),
		))
	defer span.End()

	// Parse the raw event from the Kafka message
	var rawEvent RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to unmarshal event")
		log.Error("Failed to unmarshal event", "error", err, "message", string(msg.Value))
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
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
		return nil, err
	}

	ws, err := manager.GetOrLoad(ctx, rawEvent.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("workspace not found: %s: %w", rawEvent.WorkspaceID, err)
	}

	if err := handler(ctx, ws, rawEvent); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "handler failed")
		log.Error("Handler failed to process event",
			"eventType", rawEvent.EventType,
			"error", err)
		return ws, fmt.Errorf("handler failed to process event %s: %w", rawEvent.EventType, err)
	}

	// releaseTargetChanges, err := ws.ReleaseManager().ProcessChanges(ctx, changeSet)
	// if err != nil {
	// 	span.RecordError(err)
	// 	span.SetStatus(codes.Error, "failed to process target changes")
	// 	log.Error("Failed to process target changes", "error", err)
	// 	return ws, fmt.Errorf("failed to process target changes: %w", err)
	// }

	changes := make([]persistence.Change, 0)
	span.SetAttributes(attribute.Int("changeset.count", len(ws.Changeset().Changes())))
	for _, change := range ws.Changeset().Changes() {
		entity, ok := change.Entity.(persistence.Entity)
		if !ok {
			continue
		}

		// Map statechange type to persistence type
		var persistenceType persistence.ChangeType
		switch change.Type {
		case statechange.StateChangeUpsert:
			persistenceType = persistence.ChangeTypeSet
		case statechange.StateChangeDelete:
			persistenceType = persistence.ChangeTypeUnset
		default:
			log.Warn("Unknown state change type", "type", change.Type)
			continue
		}

		changes = append(changes, persistence.Change{
			Namespace:  ws.ID,
			ChangeType: persistenceType,
			Entity:     entity,
			Timestamp:  change.Timestamp,
		})
		span.AddEvent("change", trace.WithAttributes(
			attribute.String("change.type", string(change.Type)),
			attribute.String("change.entity", fmt.Sprintf("%T: %+v", change.Entity, change.Entity)),
			attribute.Int64("change.timestamp", change.Timestamp.Unix()),
		))
	}

	if err := manager.PersistenceStore().Save(ctx, changes); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to save changes")
		log.Error("Failed to save changes", "error", err)
	}

	ws.Changeset().Clear()

	span.SetStatus(codes.Ok, "event processed successfully")
	log.Debug("Successfully processed event",
		"eventType", rawEvent.EventType)

	return ws, nil
}
