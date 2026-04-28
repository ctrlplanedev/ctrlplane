package planvalidation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/planvalidation")

const RuleTypePlanValidation = "planValidation"

var _ evaluator.Evaluator = &PlanValidationEvaluator{}

// ValidationResult represents a stored validation outcome from a plan result.
type ValidationResult struct {
	RuleID     string
	RuleName   string
	Severity   string
	Passed     bool
	Violations []byte
}

// Getters abstracts the data access needed by the plan validation evaluator.
type Getters interface {
	GetPlanValidationResultsForTarget(
		ctx context.Context,
		environmentID, resourceID, deploymentID string,
	) ([]ValidationResult, error)
}

// PlanValidationEvaluator checks stored plan validation results for the
// release target. If any error-severity rule failed, the version is denied.
type PlanValidationEvaluator struct {
	getters Getters
	ruleId  string
}

func NewEvaluator(getters Getters, policyRule *oapi.PolicyRule) evaluator.Evaluator {
	if policyRule == nil || getters == nil {
		return nil
	}

	if policyRule.PlanValidation == nil {
		return nil
	}

	return evaluator.WithMemoization(&PlanValidationEvaluator{
		getters: getters,
		ruleId:  policyRule.Id,
	})
}

func (e *PlanValidationEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeReleaseTarget
}

func (e *PlanValidationEvaluator) RuleType() string {
	return RuleTypePlanValidation
}

func (e *PlanValidationEvaluator) RuleId() string {
	return e.ruleId
}

func (e *PlanValidationEvaluator) Complexity() int {
	return 1
}

func (e *PlanValidationEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	_, span := tracer.Start(ctx, "PlanValidationEvaluator.Evaluate")
	defer span.End()

	validations, err := e.getters.GetPlanValidationResultsForTarget(
		ctx,
		scope.Environment.Id,
		scope.Resource.Id,
		scope.Deployment.Id,
	)
	if err != nil {
		span.RecordError(err)
		return results.NewAllowedResult("Failed to load plan validation results, allowing deploy").
			WithDetail("error", err.Error())
	}

	if len(validations) == 0 {
		return results.NewAllowedResult("No plan validation results found for this target")
	}

	span.SetAttributes(attribute.Int("validations.count", len(validations)))

	var failures []string
	errorCount := 0
	for _, v := range validations {
		if v.Passed {
			continue
		}
		if v.Severity != "error" {
			continue
		}
		errorCount++

		var denials []string
		if err := json.Unmarshal(v.Violations, &denials); err == nil {
			for _, msg := range denials {
				failures = append(failures, fmt.Sprintf("[%s] %s", v.RuleName, msg))
			}
		} else {
			failures = append(failures, fmt.Sprintf("[%s] validation failed", v.RuleName))
		}
	}

	if errorCount == 0 {
		return results.NewAllowedResult("All plan validations passed").
			WithDetail("validations_checked", fmt.Sprintf("%d", len(validations)))
	}

	msg := fmt.Sprintf(
		"Plan validation failed: %d rule(s) with errors\n%s",
		errorCount,
		strings.Join(failures, "\n"),
	)
	return results.NewDeniedResult(msg).
		WithDetail("failed_rules", fmt.Sprintf("%d", errorCount)).
		WithDetail("total_rules", fmt.Sprintf("%d", len(validations)))
}
