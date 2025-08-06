package operations

import (
	"time"
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
		ID:        "test-id",
		Name:      "Test Entity",
		CreatedAt: time.Time{}.Format(time.RFC3339),
		UpdatedAt: time.Time{}.Format(time.RFC3339),
		Metadata: map[string]string{
			"environment": "production",
			"owner":       "team",
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

func (e *entityBuilder) build() *matchableEntity {
	return &matchableEntity{
		ID:        e.ID,
		Name:      e.Name,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
		Metadata:  e.Metadata,
	}
}

type matchableEntity struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"created-at"`
	UpdatedAt string            `json:"updated-at"`
	Metadata  map[string]string `json:"metadata"`
}

func (m *matchableEntity) GetID() string {
	return m.ID
}

func (m *matchableEntity) GetName() string {
	return m.Name
}

func (m *matchableEntity) GetCreatedAt() time.Time {
	createdAt, _ := time.Parse(time.RFC3339, m.CreatedAt)
	return createdAt
}

func (m *matchableEntity) GetUpdatedAt() time.Time {
	updatedAt, _ := time.Parse(time.RFC3339, m.UpdatedAt)
	return updatedAt
}

func (m *matchableEntity) GetMetadata() map[string]string {
	if m.Metadata == nil {
		return make(map[string]string)
	}
	return m.Metadata
}
