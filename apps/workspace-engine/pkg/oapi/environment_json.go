package oapi

import (
	"encoding/json"
	"time"
)

// environmentAlias is used to prevent infinite recursion in UnmarshalJSON
type environmentAlias Environment

// environmentJSON is the intermediate struct for custom unmarshaling
type environmentJSON struct {
	environmentAlias
	CreatedAt json.RawMessage `json:"createdAt"`
}

// UnmarshalJSON implements custom JSON unmarshaling for Environment
// to handle backwards compatibility with old data that may have empty
// string createdAt values instead of proper timestamps, and to migrate
// legacy "systemId" (singular string) to "systemIds" (array).
func (e *Environment) UnmarshalJSON(data []byte) error {
	var aux environmentJSON
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Copy all fields from alias
	*e = Environment(aux.environmentAlias)

	// Handle createdAt specially
	if len(aux.CreatedAt) > 0 {
		// Try to unmarshal as string first (to check for empty string)
		var createdAtStr string
		if err := json.Unmarshal(aux.CreatedAt, &createdAtStr); err == nil {
			// It's a string - check if empty
			if createdAtStr == "" {
				// Use zero time for empty strings (backwards compatibility)
				e.CreatedAt = time.Time{}
			} else {
				// Try to parse the string as RFC3339
				parsed, err := time.Parse(time.RFC3339, createdAtStr)
				if err != nil {
					// Try other common formats
					parsed, err = time.Parse("2006-01-02T15:04:05Z07:00", createdAtStr)
					if err != nil {
						return err
					}
				}
				e.CreatedAt = parsed
			}
		} else {
			// Not a string, try to unmarshal directly as time.Time
			var createdAt time.Time
			if err := json.Unmarshal(aux.CreatedAt, &createdAt); err != nil {
				return err
			}
			e.CreatedAt = createdAt
		}
	}

	// Handle legacy "systemId" field from existing changelog entries
	if len(e.SystemIds) == 0 {
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(data, &raw); err == nil {
			if val, ok := raw["systemId"]; ok {
				var legacyID string
				if json.Unmarshal(val, &legacyID) == nil && legacyID != "" {
					e.SystemIds = []string{legacyID}
				}
			}
		}
	}

	return nil
}
