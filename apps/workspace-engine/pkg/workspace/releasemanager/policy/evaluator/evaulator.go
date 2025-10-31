package evaluator

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type Evaluator interface {
	Evaluate(ctx context.Context) (*oapi.RuleEvaluation, error)
}