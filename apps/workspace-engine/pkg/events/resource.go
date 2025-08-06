package events

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/logger"
)

type Resource struct {
	ID          string                 `json:"id"`
	WorkspaceID string                 `json:"workspaceId"`
	Name        string                 `json:"name"`
	Identifier  string                 `json:"identifier"`
	Kind        string                 `json:"kind"`
	Version     string                 `json:"version"`
	Config      map[string]interface{} `json:"config"`
	Metadata    map[string]string      `json:"metadata"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	DeletedAt   *time.Time             `json:"deletedAt,omitempty"`
	ProviderID  *string                `json:"providerId,omitempty"`
}

type ResourceCreatedEvent struct {
	BaseEvent
	Payload Resource `json:"payload"`
}

func handleResourceCreatedEvent(_ context.Context, event RawEvent) error {
	log := logger.Get()

	log.Info("Handling resource created event", "event", event)

	var resourceCreatedEvent ResourceCreatedEvent
	if err := parsePayload(event.Payload, &resourceCreatedEvent); err != nil {
		return fmt.Errorf("failed to parse payload: %w", err)
	}

	log.Info("Resource created event", "event", resourceCreatedEvent)

	return nil
}

type ResourceUpdatedEvent struct {
	BaseEvent
	Payload struct {
		Current  Resource `json:"current"`
		Previous Resource `json:"previous"`
	} `json:"payload"`
}

func handleResourceUpdatedEvent(_ context.Context, event RawEvent) error {
	log := logger.Get()

	log.Info("Handling resource updated event", "event", event)

	var resourceUpdatedEvent ResourceUpdatedEvent
	if err := parsePayload(event.Payload, &resourceUpdatedEvent); err != nil {
		return fmt.Errorf("failed to parse payload: %w", err)
	}

	log.Info("Resource updated event", "event", resourceUpdatedEvent)

	return nil
}

type ResourceDeletedEvent struct {
	BaseEvent
	Payload Resource `json:"payload"`
}

func handleResourceDeletedEvent(_ context.Context, event RawEvent) error {
	log := logger.Get()

	log.Info("Handling resource deleted event", "event", event)

	var resourceDeletedEvent ResourceDeletedEvent
	if err := parsePayload(event.Payload, &resourceDeletedEvent); err != nil {
		return fmt.Errorf("failed to parse payload: %w", err)
	}

	log.Info("Resource deleted event", "event", resourceDeletedEvent)

	return nil
}
