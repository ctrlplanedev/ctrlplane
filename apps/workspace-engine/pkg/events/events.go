package events

type EventType string

const (
	ResourceCreated EventType = "resource.created"
	ResourceUpdated EventType = "resource.updated"
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
	Payload map[string]any `json:"payload,omitempty"`
}
