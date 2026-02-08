package metrics

import (
	"fmt"
	"workspace-engine/pkg/celutil"

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

	env, err := cel.NewEnv(
		cel.Variable("result", cel.MapType(cel.StringType, cel.AnyType)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	ast, issues := env.Compile(successCondition)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("failed to compile condition: %w", issues.Err())
	}

	program, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL program: %w", err)
	}

	return &Evaluator{program: program}, nil
}

// Evaluate evaluates the success condition against measurement data
func (e *Evaluator) Evaluate(data map[string]any) (bool, error) {
	return celutil.EvalBool(e.program, map[string]any{
		"result": data,
	})
}
