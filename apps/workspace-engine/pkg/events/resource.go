package events

import "time"

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

type ResourceUpdatedEvent struct {
	BaseEvent
	Payload struct {
		Current  Resource `json:"current"`
		Previous Resource `json:"previous"`
	}
}

type ResourceDeletedEvent struct {
	BaseEvent
	Payload Resource `json:"payload"`
}
