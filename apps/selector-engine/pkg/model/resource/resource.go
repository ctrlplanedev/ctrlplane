package resource

import "time"

type Resource struct {
	ID          string            `json:"id"`
	WorkspaceID string            `json:"workspace_id"`
	Identifier  string            `json:"identifier"`
	Name        string            `json:"name"`
	Kind        string            `json:"kind"`
	Version     string            `json:"version"`
	CreatedAt   time.Time         `json:"created_at"`
	LastSync    time.Time         `json:"last_sync"`
	Metadata    map[string]string `json:"metadata"`
}

type ResourceRef struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
}
