package oapi

import "encoding/json"

// UnmarshalJSON handles backward compatibility with legacy changelog entries
// that store a singular "systemId" string instead of the new "systemIds" array.
func (d *Deployment) UnmarshalJSON(data []byte) error {
	type Alias Deployment
	var alias Alias
	if err := json.Unmarshal(data, &alias); err != nil {
		return err
	}
	*d = Deployment(alias)

	if len(d.SystemIds) == 0 {
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(data, &raw); err == nil {
			if val, ok := raw["systemId"]; ok {
				var legacyID string
				if json.Unmarshal(val, &legacyID) == nil && legacyID != "" {
					d.SystemIds = []string{legacyID}
				}
			}
		}
	}
	return nil
}

// Note: Environment.UnmarshalJSON is defined in environment_json.go
// which handles both the createdAt backward compatibility and the
// legacy systemId -> systemIds migration.
