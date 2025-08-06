package operations

import (
	"time"
	"workspace-engine/pkg/engine/selector"
)

var now = time.Now()
var halfDayAgo = now.Add(-12 * time.Hour)
var yesterday = now.Add(-24 * time.Hour)
var twoDaysAgo = now.Add(-48 * time.Hour)
var tomorrow = now.Add(24 * time.Hour)

// Builder to create a selector.MatchableEntity
type entityBuilder struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"created-at"`
	UpdatedAt string            `json:"updated-at"`
	Metadata  map[string]string `json:"metadata"`
}

func newEntityBuilder() *entityBuilder {
	return &entityBuilder{
		ID:        "test-123",
		Name:      "Test Entity",
		CreatedAt: yesterday.Format(time.RFC3339),
		UpdatedAt: now.Format(time.RFC3339),
		Metadata: map[string]string{
			"environment": "production",
			"owner":       "team-a",
		},
	}
}

func (e *entityBuilder) createdAt(createdAt time.Time) *entityBuilder {
	e.CreatedAt = createdAt.Format(time.RFC3339)
	return e
}

func (e *entityBuilder) updatedAt(updatedAt time.Time) *entityBuilder {
	e.UpdatedAt = updatedAt.Format(time.RFC3339)
	return e
}

func (e *entityBuilder) id(id string) *entityBuilder {
	e.ID = id
	return e
}

func (e *entityBuilder) name(name string) *entityBuilder {
	e.Name = name
	return e
}

func (e *entityBuilder) metadata(metadata map[string]string) *entityBuilder {
	e.Metadata = metadata
	return e
}

func (e *entityBuilder) build() selector.MatchableEntity {
	return &matchableEntity{
		ID:        e.ID,
		Name:      e.Name,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
		Metadata:  e.Metadata,
	}
}

func (m *matchableEntity) GetID() string {
	return m.ID
}

type matchableEntity struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"created-at"`
	UpdatedAt string            `json:"updated-at"`
	Metadata  map[string]string `json:"metadata"`
}
