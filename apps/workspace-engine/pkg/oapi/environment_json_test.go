package oapi

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnvironment_UnmarshalJSON(t *testing.T) {
	t.Run("normal timestamp", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","createdAt":"2024-01-01T00:00:00Z","systemIds":["sys-1"]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.NoError(t, err)
		assert.Equal(t, "env-1", env.Id)
		assert.Equal(t, "prod", env.Name)
		assert.Equal(t, 2024, env.CreatedAt.Year())
	})

	t.Run("empty createdAt string", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","createdAt":"","systemIds":["sys-1"]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.NoError(t, err)
		assert.True(t, env.CreatedAt.IsZero())
	})

	t.Run("missing createdAt", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","systemIds":["sys-1"]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.NoError(t, err)
	})

	t.Run("legacy systemId field", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","createdAt":"2024-01-01T00:00:00Z","systemId":"legacy-sys"}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.NoError(t, err)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		data := `{invalid`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.Error(t, err)
	})

	t.Run("invalid createdAt format", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","createdAt":"not-a-date","systemIds":[]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.Error(t, err)
	})

	t.Run("createdAt as RFC3339 with timezone offset", func(t *testing.T) {
		data := `{"id":"env-1","name":"prod","createdAt":"2024-06-15T10:30:00+05:00","systemIds":[]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		require.NoError(t, err)
		assert.Equal(t, 2024, env.CreatedAt.Year())
		assert.Equal(t, time.June, env.CreatedAt.Month())
	})

	t.Run("createdAt as numeric timestamp", func(t *testing.T) {
		// time.Time JSON unmarshal supports RFC3339 strings, so a raw number won't work
		// but a valid RFC3339 as non-string shouldn't exist. Test that non-string
		// createdAt handling works for valid time.Time JSON (which is always a string).
		// Actually test the "not a string" branch with an invalid value.
		data := `{"id":"env-1","name":"prod","createdAt":12345,"systemIds":[]}`
		var env Environment
		err := json.Unmarshal([]byte(data), &env)
		// A raw number can't be unmarshaled as time.Time
		require.Error(t, err)
	})
}
