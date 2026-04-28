package planvalidation

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	results []ValidationResult
	err     error
}

func (m *mockGetters) GetPlanValidationResultsForTarget(
	_ context.Context,
	_, _, _ string,
) ([]ValidationResult, error) {
	return m.results, m.err
}

func makeScope() evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: "env-1", Name: "production"},
		Resource:    &oapi.Resource{Id: "res-1", Name: "web-server"},
		Deployment:  &oapi.Deployment{Id: "dep-1", Name: "web-app"},
	}
}

func TestPlanValidationEvaluator_NoResults(t *testing.T) {
	getter := &mockGetters{results: nil}
	e := &PlanValidationEvaluator{getters: getter, ruleId: "rule-1"}

	result := e.Evaluate(context.Background(), makeScope())
	require.NotNil(t, result)
	assert.True(t, result.Allowed)
}

func TestPlanValidationEvaluator_AllPassed(t *testing.T) {
	getter := &mockGetters{
		results: []ValidationResult{
			{RuleID: "r1", RuleName: "check-limits", Severity: "error", Passed: true, Violations: []byte("[]")},
			{RuleID: "r2", RuleName: "check-labels", Severity: "warning", Passed: true, Violations: []byte("[]")},
		},
	}
	e := &PlanValidationEvaluator{getters: getter, ruleId: "rule-1"}

	result := e.Evaluate(context.Background(), makeScope())
	require.NotNil(t, result)
	assert.True(t, result.Allowed)
}

func TestPlanValidationEvaluator_ErrorSeverityFails(t *testing.T) {
	violations, _ := json.Marshal([]map[string]string{
		{"msg": "Container missing limits"},
	})
	getter := &mockGetters{
		results: []ValidationResult{
			{RuleID: "r1", RuleName: "check-limits", Severity: "error", Passed: false, Violations: violations},
		},
	}
	e := &PlanValidationEvaluator{getters: getter, ruleId: "rule-1"}

	result := e.Evaluate(context.Background(), makeScope())
	require.NotNil(t, result)
	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "check-limits")
	assert.Contains(t, result.Message, "Container missing limits")
}

func TestPlanValidationEvaluator_WarningDoesNotBlock(t *testing.T) {
	violations, _ := json.Marshal([]map[string]string{
		{"msg": "Missing optional label"},
	})
	getter := &mockGetters{
		results: []ValidationResult{
			{RuleID: "r1", RuleName: "check-labels", Severity: "warning", Passed: false, Violations: violations},
		},
	}
	e := &PlanValidationEvaluator{getters: getter, ruleId: "rule-1"}

	result := e.Evaluate(context.Background(), makeScope())
	require.NotNil(t, result)
	assert.True(t, result.Allowed)
}

func TestPlanValidationEvaluator_MixedSeverity(t *testing.T) {
	errorViolations, _ := json.Marshal([]map[string]string{
		{"msg": "Critical error"},
	})
	warningViolations, _ := json.Marshal([]map[string]string{
		{"msg": "Minor warning"},
	})
	getter := &mockGetters{
		results: []ValidationResult{
			{RuleID: "r1", RuleName: "critical-check", Severity: "error", Passed: false, Violations: errorViolations},
			{RuleID: "r2", RuleName: "minor-check", Severity: "warning", Passed: false, Violations: warningViolations},
		},
	}
	e := &PlanValidationEvaluator{getters: getter, ruleId: "rule-1"}

	result := e.Evaluate(context.Background(), makeScope())
	require.NotNil(t, result)
	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "1 rule(s)")
}

func TestPlanValidationEvaluator_ScopeFields(t *testing.T) {
	e := &PlanValidationEvaluator{ruleId: "rule-1"}
	assert.Equal(t, evaluator.ScopeReleaseTarget, e.ScopeFields())
}

func TestPlanValidationEvaluator_RuleType(t *testing.T) {
	e := &PlanValidationEvaluator{ruleId: "rule-1"}
	assert.Equal(t, RuleTypePlanValidation, e.RuleType())
}

func TestNewEvaluator_NilRule(t *testing.T) {
	result := NewEvaluator(&mockGetters{}, nil)
	assert.Nil(t, result)
}

func TestNewEvaluator_NilGetters(t *testing.T) {
	result := NewEvaluator(nil, &oapi.PolicyRule{})
	assert.Nil(t, result)
}

func TestNewEvaluator_NoPlanValidation(t *testing.T) {
	result := NewEvaluator(&mockGetters{}, &oapi.PolicyRule{})
	assert.Nil(t, result)
}
