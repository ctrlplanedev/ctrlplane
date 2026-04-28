package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/planvalidation"
)

// Validator runs OPA/Rego plan validation rules against completed plan results.
type Validator struct {
	getter ValidatorGetter
	setter ValidatorSetter
}

// ValidatorGetter abstracts reads needed for plan validation.
type ValidatorGetter interface {
	ListPlanValidationRulesByWorkspaceID(
		ctx context.Context,
		workspaceID uuid.UUID,
	) ([]db.ListPlanValidationRulesByWorkspaceIDRow, error)
}

// ValidatorSetter abstracts writes needed for plan validation.
type ValidatorSetter interface {
	UpsertPlanTargetResultValidation(
		ctx context.Context,
		arg db.UpsertPlanTargetResultValidationParams,
	) error
}

func NewValidator(getter ValidatorGetter, setter ValidatorSetter) *Validator {
	return &Validator{getter: getter, setter: setter}
}

// ValidatePlanResult evaluates all applicable OPA plan validation rules
// against the completed plan result and persists the outcomes.
func (v *Validator) ValidatePlanResult(
	ctx context.Context,
	resultID uuid.UUID,
	workspaceID uuid.UUID,
	dispatchCtx *oapi.DispatchContext,
	current, proposed string,
	hasChanges bool,
) error {
	ctx, span := tracer.Start(ctx, "Validator.ValidatePlanResult")
	defer span.End()

	rules, err := v.getter.ListPlanValidationRulesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("list plan validation rules: %w", err)
	}

	if len(rules) == 0 {
		span.AddEvent("no plan validation rules configured")
		return nil
	}

	span.SetAttributes(attribute.Int("rules.count", len(rules)))

	input := planvalidation.Input{
		Current:    current,
		Proposed:   proposed,
		AgentType:  dispatchCtx.JobAgent.Type,
		HasChanges: hasChanges,
	}
	if dispatchCtx.Environment != nil {
		input.Environment = dispatchCtx.Environment
	}
	if dispatchCtx.Resource != nil {
		input.Resource = dispatchCtx.Resource
	}
	if dispatchCtx.Deployment != nil {
		input.Deployment = dispatchCtx.Deployment
	}
	if dispatchCtx.Version != nil {
		input.Version = dispatchCtx.Version
	}

	for _, rule := range rules {
		if err := v.evaluateRule(ctx, resultID, rule, input); err != nil {
			span.RecordError(err)
		}
	}

	return nil
}

func (v *Validator) evaluateRule(
	ctx context.Context,
	resultID uuid.UUID,
	rule db.ListPlanValidationRulesByWorkspaceIDRow,
	input planvalidation.Input,
) error {
	ctx, span := tracer.Start(ctx, "Validator.evaluateRule")
	defer span.End()

	span.SetAttributes(
		attribute.String("rule.id", rule.ID.String()),
		attribute.String("rule.name", rule.Name),
		attribute.String("rule.severity", rule.Severity),
	)

	result, err := planvalidation.Evaluate(ctx, rule.Rego, input)
	if err != nil {
		violationsJSON, _ := json.Marshal([]planvalidation.Violation{
			{Msg: fmt.Sprintf("Rego evaluation error: %s", err.Error())},
		})
		return v.setter.UpsertPlanTargetResultValidation(ctx, db.UpsertPlanTargetResultValidationParams{
			ResultID:   resultID,
			RuleID:     rule.ID,
			Passed:     false,
			Violations: violationsJSON,
		})
	}

	span.SetAttributes(
		attribute.Bool("result.passed", result.Passed),
		attribute.Int("result.violations", len(result.Violations)),
	)

	violationsJSON, err := json.Marshal(result.Violations)
	if err != nil {
		return fmt.Errorf("marshal violations: %w", err)
	}

	return v.setter.UpsertPlanTargetResultValidation(ctx, db.UpsertPlanTargetResultValidationParams{
		ResultID:   resultID,
		RuleID:     rule.ID,
		Passed:     result.Passed,
		Violations: violationsJSON,
	})
}
