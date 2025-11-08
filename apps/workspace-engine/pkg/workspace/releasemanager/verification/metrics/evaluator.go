package metrics

import (
	"fmt"

	"github.com/google/cel-go/cel"
)

// Evaluator evaluates success conditions using CEL
type Evaluator struct {
	program cel.Program
}

// NewEvaluator creates a new CEL evaluator for a success condition
func NewEvaluator(successCondition string) (*Evaluator, error) {
	if successCondition == "" {
		return nil, fmt.Errorf("success condition cannot be empty")
	}

	// Create CEL environment
	env, err := cel.NewEnv(
		cel.Variable("result", cel.MapType(cel.StringType, cel.AnyType)),
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	// Compile expression
	ast, issues := env.Compile(successCondition)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("failed to compile condition: %w", issues.Err())
	}

	// Create program
	program, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL program: %w", err)
	}

	return &Evaluator{program: program}, nil
}

// Evaluate evaluates the success condition against measurement data
func (e *Evaluator) Evaluate(data map[string]any) (bool, error) {
	// Evaluate CEL expression
	out, _, err := e.program.Eval(map[string]any{
		"result": data,
	})
	if err != nil {
		return false, fmt.Errorf("evaluation failed: %w", err)
	}

	// Check result type
	boolVal, ok := out.Value().(bool)
	if !ok {
		return false, fmt.Errorf("condition must return boolean, got: %T", out.Value())
	}

	return boolVal, nil
}
