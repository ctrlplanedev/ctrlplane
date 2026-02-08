package celutil

import (
	"testing"

	"github.com/google/cel-go/cel"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func compileProgram(t *testing.T, expr string, opts ...cel.EnvOption) cel.Program {
	t.Helper()
	env, err := cel.NewEnv(opts...)
	require.NoError(t, err)
	ast, iss := env.Compile(expr)
	require.NoError(t, iss.Err())
	prg, err := env.Program(ast)
	require.NoError(t, err)
	return prg
}

func TestEvalBool(t *testing.T) {
	t.Run("returns true", func(t *testing.T) {
		prg := compileProgram(t, "x > 0",
			cel.Variable("x", cel.IntType),
		)
		result, err := EvalBool(prg, map[string]any{"x": int64(5)})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("returns false", func(t *testing.T) {
		prg := compileProgram(t, "x > 10",
			cel.Variable("x", cel.IntType),
		)
		result, err := EvalBool(prg, map[string]any{"x": int64(5)})
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("missing key returns false without error", func(t *testing.T) {
		prg := compileProgram(t, `m["missing_key"] == "value"`,
			cel.Variable("m", cel.MapType(cel.StringType, cel.StringType)),
		)
		result, err := EvalBool(prg, map[string]any{
			"m": map[string]string{},
		})
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("non-boolean result returns error", func(t *testing.T) {
		prg := compileProgram(t, "x + 1",
			cel.Variable("x", cel.IntType),
		)
		_, err := EvalBool(prg, map[string]any{"x": int64(5)})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "boolean")
	})
}

func TestVariables(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		expected []string
	}{
		{
			name:     "single variable",
			expr:     "resource.name == 'x'",
			expected: []string{"resource"},
		},
		{
			name:     "multiple variables",
			expr:     "resource.name == 'x' && environment.name == 'y'",
			expected: []string{"resource", "environment"},
		},
		{
			name:     "deduplicated variables",
			expr:     "resource.name == 'x' && resource.kind == 'y'",
			expected: []string{"resource"},
		},
		{
			name:     "nested property access",
			expr:     "resource.metadata.labels.app == 'web'",
			expected: []string{"resource"},
		},
		{
			name:     "three variables",
			expr:     "resource.name == 'x' && environment.name == 'y' || system.id == 'z'",
			expected: []string{"resource", "environment", "system"},
		},
		{
			name:     "standalone identifier",
			expr:     "enabled",
			expected: []string{"enabled"},
		},
		{
			name:     "no variables in literal expression",
			expr:     "1 + 2 == 3",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vars, err := Variables(tt.expr)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, vars)
		})
	}
}

func TestVariables_InvalidExpression(t *testing.T) {
	_, err := Variables(">>>invalid<<<")
	assert.Error(t, err)
}
