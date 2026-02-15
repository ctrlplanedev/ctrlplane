package celutil

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildCached(t *testing.T) {
	t.Run("basic cached env", func(t *testing.T) {
		ce, err := NewEnvBuilder().
			WithMapVariable("resource").
			WithStandardExtensions().
			BuildCached(5 * time.Minute)
		require.NoError(t, err)
		require.NotNil(t, ce)
		require.NotNil(t, ce.Env())
	})

	t.Run("compile and cache", func(t *testing.T) {
		ce, err := NewEnvBuilder().
			WithMapVariable("resource").
			BuildCached(5 * time.Minute)
		require.NoError(t, err)

		prg, err := ce.Compile(`resource.name == "test"`)
		require.NoError(t, err)
		require.NotNil(t, prg)

		// Second call should hit cache
		prg2, err := ce.Compile(`resource.name == "test"`)
		require.NoError(t, err)
		require.NotNil(t, prg2)
	})

	t.Run("compile invalid expression", func(t *testing.T) {
		ce, err := NewEnvBuilder().BuildCached(5 * time.Minute)
		require.NoError(t, err)

		_, err = ce.Compile(`>>>invalid<<<`)
		require.Error(t, err)
	})

	t.Run("validate valid expression", func(t *testing.T) {
		ce, err := NewEnvBuilder().
			WithMapVariable("x").
			BuildCached(5 * time.Minute)
		require.NoError(t, err)

		err = ce.Validate(`x.name == "test"`)
		require.NoError(t, err)
	})

	t.Run("validate invalid expression", func(t *testing.T) {
		ce, err := NewEnvBuilder().BuildCached(5 * time.Minute)
		require.NoError(t, err)

		err = ce.Validate(`>>>invalid<<<`)
		require.Error(t, err)
	})
}

func TestEntityToMap(t *testing.T) {
	t.Run("already a map", func(t *testing.T) {
		m := map[string]any{"key": "value"}
		result, err := EntityToMap(m)
		require.NoError(t, err)
		assert.Equal(t, m, result)
	})

	t.Run("struct to map", func(t *testing.T) {
		type TestEntity struct {
			Name string `json:"name"`
			Age  int    `json:"age"`
		}
		result, err := EntityToMap(TestEntity{Name: "test", Age: 25})
		require.NoError(t, err)
		assert.Equal(t, "test", result["name"])
		assert.Equal(t, float64(25), result["age"]) // JSON numbers are float64
	})

	t.Run("unmarshalable value", func(t *testing.T) {
		_, err := EntityToMap(make(chan int))
		require.Error(t, err)
	})
}

func TestVariables_ListExpression(t *testing.T) {
	vars, err := Variables(`[resource.name, environment.id].exists(x, x == "test")`)
	require.NoError(t, err)
	assert.Contains(t, vars, "resource")
	assert.Contains(t, vars, "environment")
}

func TestVariables_MapExpression(t *testing.T) {
	vars, err := Variables(`{"key": resource.name}`)
	require.NoError(t, err)
	assert.Contains(t, vars, "resource")
}

func TestVariables_ComprehensionExpression(t *testing.T) {
	vars, err := Variables(`[1, 2, 3].map(x, x * multiplier)`)
	require.NoError(t, err)
	assert.Contains(t, vars, "multiplier")
}
