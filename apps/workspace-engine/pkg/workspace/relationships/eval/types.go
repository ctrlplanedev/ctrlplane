package eval

import "github.com/google/uuid"

// EntityData holds the entity representation needed for CEL-based
// relationship evaluation. Raw is the map passed into the CEL context
// as "from" or "to".
type EntityData struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	EntityType  string // "resource", "deployment", or "environment"
	Raw         map[string]any
}

// Rule holds a relationship rule with the raw CEL expression and
// parsed from/to type guards.
type Rule struct {
	ID        uuid.UUID
	Reference string
	Cel       string
}

// Match is a single directional relationship edge produced by evaluation.
type Match struct {
	RuleID         uuid.UUID
	Reference      string
	FromEntityType string
	FromEntityID   uuid.UUID
	ToEntityType   string
	ToEntityID     uuid.UUID
}
