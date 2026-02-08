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

	t.Run("eval error for wrong type returns error", func(t *testing.T) {
		prg := compileProgram(t, "x > 0",
			cel.Variable("x", cel.IntType),
		)
		_, err := EvalBool(prg, map[string]any{"x": "not_an_int"})
		assert.Error(t, err)
	})

	t.Run("string result returns error", func(t *testing.T) {
		prg := compileProgram(t, "x",
			cel.Variable("x", cel.StringType),
		)
		_, err := EvalBool(prg, map[string]any{"x": "hello"})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "boolean")
	})

	t.Run("complex boolean expression", func(t *testing.T) {
		prg := compileProgram(t, "x > 0 && y < 10 && z == 'ok'",
			cel.Variable("x", cel.IntType),
			cel.Variable("y", cel.IntType),
			cel.Variable("z", cel.StringType),
		)
		result, err := EvalBool(prg, map[string]any{
			"x": int64(5),
			"y": int64(3),
			"z": "ok",
		})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("complex boolean expression partial false", func(t *testing.T) {
		prg := compileProgram(t, "x > 0 && y < 10 && z == 'ok'",
			cel.Variable("x", cel.IntType),
			cel.Variable("y", cel.IntType),
			cel.Variable("z", cel.StringType),
		)
		result, err := EvalBool(prg, map[string]any{
			"x": int64(5),
			"y": int64(3),
			"z": "nope",
		})
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("boolean literal true", func(t *testing.T) {
		prg := compileProgram(t, "true")
		result, err := EvalBool(prg, map[string]any{})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("boolean literal false", func(t *testing.T) {
		prg := compileProgram(t, "false")
		result, err := EvalBool(prg, map[string]any{})
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("missing variable returns error", func(t *testing.T) {
		prg := compileProgram(t, "x > 0",
			cel.Variable("x", cel.IntType),
		)
		_, err := EvalBool(prg, map[string]any{})
		assert.Error(t, err)
	})

	t.Run("list contains expression", func(t *testing.T) {
		prg := compileProgram(t, `x in ["a", "b", "c"]`,
			cel.Variable("x", cel.StringType),
		)
		result, err := EvalBool(prg, map[string]any{"x": "b"})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("list not contains expression", func(t *testing.T) {
		prg := compileProgram(t, `!(x in ["a", "b", "c"])`,
			cel.Variable("x", cel.StringType),
		)
		result, err := EvalBool(prg, map[string]any{"x": "z"})
		require.NoError(t, err)
		assert.True(t, result)
	})
}

func TestNewEnvBuilder(t *testing.T) {
	t.Run("with map variables and standard extensions", func(t *testing.T) {
		env, err := NewEnvBuilder().
			WithMapVariables("resource", "environment").
			WithStandardExtensions().
			Build()
		require.NoError(t, err)

		ast, iss := env.Compile(`resource.name == "x" && environment.name.startsWith("prod")`)
		require.NoError(t, iss.Err())

		prg, err := env.Program(ast)
		require.NoError(t, err)

		result, err := EvalBool(prg, map[string]any{
			"resource":    map[string]any{"name": "x"},
			"environment": map[string]any{"name": "production"},
		})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("with single map variable", func(t *testing.T) {
		env, err := NewEnvBuilder().
			WithMapVariable("result").
			Build()
		require.NoError(t, err)

		ast, iss := env.Compile(`result.ok == true`)
		require.NoError(t, iss.Err())

		prg, err := env.Program(ast)
		require.NoError(t, err)

		result, err := EvalBool(prg, map[string]any{
			"result": map[string]any{"ok": true},
		})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("with custom typed variable", func(t *testing.T) {
		env, err := NewEnvBuilder().
			WithVariable("count", cel.IntType).
			Build()
		require.NoError(t, err)

		ast, iss := env.Compile(`count > 5`)
		require.NoError(t, iss.Err())

		prg, err := env.Program(ast)
		require.NoError(t, err)

		result, err := EvalBool(prg, map[string]any{"count": int64(10)})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("with raw option", func(t *testing.T) {
		env, err := NewEnvBuilder().
			WithOption(cel.Variable("x", cel.BoolType)).
			Build()
		require.NoError(t, err)

		ast, iss := env.Compile(`x`)
		require.NoError(t, iss.Err())

		prg, err := env.Program(ast)
		require.NoError(t, err)

		result, err := EvalBool(prg, map[string]any{"x": true})
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("empty builder creates valid env", func(t *testing.T) {
		env, err := NewEnvBuilder().Build()
		require.NoError(t, err)

		ast, iss := env.Compile(`1 + 2 == 3`)
		require.NoError(t, iss.Err())

		prg, err := env.Program(ast)
		require.NoError(t, err)

		result, err := EvalBool(prg, map[string]any{})
		require.NoError(t, err)
		assert.True(t, result)
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
