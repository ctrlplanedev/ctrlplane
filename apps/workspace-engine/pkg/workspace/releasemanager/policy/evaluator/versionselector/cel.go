package versionselector

import (
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"

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
	if program, ok := compilationCache.Get(expression); ok {
		return program, nil
	}

	ast, iss := Env.Compile(expression)
	if iss.Err() != nil {
		return nil, fmt.Errorf("failed to compile CEL expression: %w", iss.Err())
	}

	program, err := Env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL program: %w", err)
	}

	compilationCache.SetWithTTL(expression, program, 1, 12*time.Hour)

	return program, nil
}

// evaluate evaluates a CEL program with the given context
func evaluate(program cel.Program, celCtx map[string]any) (bool, error) {
	return celutil.EvalBool(program, celCtx)
}

// entityToMap converts an entity (struct) to a map for CEL evaluation
func entityToMap(entity any) (map[string]any, error) {
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
