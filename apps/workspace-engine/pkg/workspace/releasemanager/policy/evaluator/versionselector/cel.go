package versionselector

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/dgraph-io/ristretto/v2"
	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

// Env is the CEL environment for version selector expressions.
// Available variables:
// - version: The deployment version being evaluated
// - environment: The target environment
// - resource: The target resource
// - deployment: The deployment
var Env, _ = cel.NewEnv(
	cel.Variable("version", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("environment", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("resource", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("deployment", cel.MapType(cel.StringType, cel.AnyType)),
	ext.Strings(),
	ext.Math(),
	ext.Lists(),
	ext.Sets(),
)

// compilationCache caches compiled CEL programs for performance
var compilationCache, _ = ristretto.NewCache(&ristretto.Config[string, cel.Program]{
	NumCounters: 10000,
	MaxCost:     1 << 28, // 256MB
	BufferItems: 64,
})

// compile compiles a CEL expression and caches the result
func compile(expression string) (cel.Program, error) {
	// Check cache first
	if program, ok := compilationCache.Get(expression); ok {
		return program, nil
	}

	// Compile the expression
	ast, iss := Env.Compile(expression)
	if iss.Err() != nil {
		return nil, fmt.Errorf("failed to compile CEL expression: %w", iss.Err())
	}

	program, err := Env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL program: %w", err)
	}

	// Cache the compiled program (TTL of 12 hours)
	compilationCache.SetWithTTL(expression, program, 1, 12*time.Hour)

	return program, nil
}

// evaluate evaluates a CEL program with the given context
func evaluate(program cel.Program, celCtx map[string]any) (bool, error) {
	val, _, err := program.Eval(celCtx)
	if err != nil {
		// If the CEL expression fails due to a missing key, treat as non-match
		if contains(err.Error(), "no such key:") {
			return false, nil
		}
		return false, fmt.Errorf("CEL evaluation failed: %w", err)
	}

	result := val.ConvertToType(cel.BoolType)
	boolVal, ok := result.Value().(bool)
	if !ok {
		return false, fmt.Errorf("CEL expression must return boolean, got: %T", result.Value())
	}

	return boolVal, nil
}

// entityToMap converts an entity (struct) to a map for CEL evaluation
func entityToMap(entity any) (map[string]any, error) {
	// Marshal to JSON and back to map to ensure CEL-compatible structure
	jsonBytes, err := json.Marshal(entity)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}

	var result map[string]any
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}

	return result, nil
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
