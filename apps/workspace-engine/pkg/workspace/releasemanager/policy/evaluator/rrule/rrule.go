package rrule

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"github.com/teambition/rrule-go"
)

var _ evaluator.WorkspaceScopedEvaluator = &RRuleEvaluator{}

type RRuleEvaluator struct {
	store *store.Store
	rrule *rrule.RRule
}

func NewRRuleEvaluator(store *store.Store) (*RRuleEvaluator, error) {
	r, err := rrule.NewRRule(rrule.ROption{
		Interval: 1,
		Count: 10,
		Until: time.Now().Add(10 * time.Minute),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create rrule: %w", err)
	}
	return &RRuleEvaluator{
		store: store,
		rrule: r,
	}, nil
}

func (e *RRuleEvaluator) Evaluate(
	ctx context.Context,
) (*results.RuleEvaluationResult, error) {
	return results.NewAllowedResult("R rule evaluation"), nil
}