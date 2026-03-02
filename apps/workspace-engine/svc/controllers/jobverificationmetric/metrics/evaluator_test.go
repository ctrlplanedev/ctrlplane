package metrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEvaluator_EmptyCondition(t *testing.T) {
	_, err := NewEvaluator("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "success condition cannot be empty")
}

func TestNewEvaluator_InvalidCEL(t *testing.T) {
	_, err := NewEvaluator("this is not valid CEL {{{}}")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to compile condition")
}

func TestNewEvaluator_ValidCondition(t *testing.T) {
	eval, err := NewEvaluator("result.status == 'ok'")
	require.NoError(t, err)
	assert.NotNil(t, eval)
}

func TestEvaluate_BooleanLiteral_True(t *testing.T) {
	eval, err := NewEvaluator("true")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{})
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestEvaluate_BooleanLiteral_False(t *testing.T) {
	eval, err := NewEvaluator("false")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{})
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestEvaluate_StringEquality_Match(t *testing.T) {
	eval, err := NewEvaluator("result.status == 'ok'")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{"status": "ok"})
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestEvaluate_StringEquality_NoMatch(t *testing.T) {
	eval, err := NewEvaluator("result.status == 'ok'")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{"status": "error"})
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestEvaluate_NumericComparison(t *testing.T) {
	eval, err := NewEvaluator("result.count > 5")
	require.NoError(t, err)

	tests := []struct {
		name   string
		count  any
		expect bool
	}{
		{"above threshold", int64(10), true},
		{"at threshold", int64(5), false},
		{"below threshold", int64(1), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ok, err := eval.Evaluate(map[string]any{"count": tt.count})
			require.NoError(t, err)
			assert.Equal(t, tt.expect, ok)
		})
	}
}

func TestEvaluate_LogicalAnd(t *testing.T) {
	eval, err := NewEvaluator("result.status == 'ok' && result.code == 200")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{"status": "ok", "code": int64(200)})
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = eval.Evaluate(map[string]any{"status": "ok", "code": int64(500)})
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestEvaluate_LogicalOr(t *testing.T) {
	eval, err := NewEvaluator("result.status == 'ok' || result.status == 'healthy'")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{"status": "healthy"})
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = eval.Evaluate(map[string]any{"status": "degraded"})
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestEvaluate_MissingKey_ReturnsFalse(t *testing.T) {
	eval, err := NewEvaluator("result.nonexistent == 'x'")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{})
	require.NoError(t, err)
	assert.False(t, ok, "missing key should evaluate to false")
}

func TestEvaluate_NestedMap(t *testing.T) {
	eval, err := NewEvaluator("result.nested.value == 'deep'")
	require.NoError(t, err)

	ok, err := eval.Evaluate(map[string]any{
		"nested": map[string]any{"value": "deep"},
	})
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestEvaluate_Reusable(t *testing.T) {
	eval, err := NewEvaluator("result.ok == true")
	require.NoError(t, err)

	ok1, err := eval.Evaluate(map[string]any{"ok": true})
	require.NoError(t, err)
	assert.True(t, ok1)

	ok2, err := eval.Evaluate(map[string]any{"ok": false})
	require.NoError(t, err)
	assert.False(t, ok2)
}
