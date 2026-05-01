package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/jobagents/types"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/planvalidation"
	"workspace-engine/pkg/policies/match"
)

func RunPlanValidation(
	ctx context.Context,
	getter Getter,
	setter Setter,
	result db.DeploymentPlanTargetResult,
	planResult *types.PlanResult,
	dispatchCtx oapi.DispatchContext,
) error {
	ctx, span := tracer.Start(ctx, "RunPlanValidation")
	defer span.End()

	span.SetAttributes(attribute.String("result_id", result.ID.String()))

	target := &match.Target{
		Deployment:  dispatchCtx.Deployment,
		Environment: dispatchCtx.Environment,
		Resource:    dispatchCtx.Resource,
	}

	workspaceID, err := uuid.Parse(dispatchCtx.Environment.WorkspaceId)
	if err != nil {
		return fmt.Errorf("parse workspace id: %w", err)
	}

	rules, err := getter.GetMatchingPlanValidationOpaRules(ctx, workspaceID, target)
	if err != nil {
		return fmt.Errorf("get matching opa rules: %w", err)
	}

	span.SetAttributes(attribute.Int("rules.count", len(rules)))

	if len(rules) == 0 {
		return nil
	}

	input, err := buildOpaInput(ctx, getter, result.TargetID, planResult, dispatchCtx)
	if err != nil {
		return fmt.Errorf("build opa input: %w", err)
	}

	results, err := evaluateRules(ctx, rules, input)
	if err != nil {
		return fmt.Errorf("evaluate rules: %w", err)
	}

	span.SetAttributes(attribute.Int("rules.evaluated", len(results)))

	for _, rule := range rules {
		res, ok := results[rule.Id]
		if !ok {
			continue
		}
		if err := persistResult(ctx, setter, result.ID, rule, res); err != nil {
			return fmt.Errorf("persist result for rule %s: %w", rule.Id, err)
		}
	}

	return nil
}

func buildOpaInput(
	ctx context.Context,
	getter Getter,
	planTargetID uuid.UUID,
	planResult *types.PlanResult,
	dispatchCtx oapi.DispatchContext,
) (planvalidation.Input, error) {
	currentVersion, err := getter.GetCurrentVersionForPlanTarget(ctx, planTargetID)
	if err != nil {
		return planvalidation.Input{}, fmt.Errorf("get current version: %w", err)
	}

	return planvalidation.Input{
		Current:         planResult.Current,
		Proposed:        planResult.Proposed,
		HasChanges:      planResult.HasChanges,
		AgentType:       dispatchCtx.JobAgent.Type,
		Deployment:      dispatchCtx.Deployment,
		Environment:     dispatchCtx.Environment,
		Resource:        dispatchCtx.Resource,
		ProposedVersion: dispatchCtx.Version,
		CurrentVersion:  currentVersion,
	}, nil
}

func evaluateRules(
	ctx context.Context,
	rules []oapi.PolicyRule,
	input planvalidation.Input,
) (map[string]*planvalidation.Result, error) {
	results := make(map[string]*planvalidation.Result, len(rules))
	for _, rule := range rules {
		if rule.PlanValidationOpa == nil {
			continue
		}
		res, err := planvalidation.Evaluate(ctx, rule.PlanValidationOpa.Rego, input)
		if err != nil {
			return nil, fmt.Errorf("evaluate rule %s: %w", rule.Id, err)
		}
		results[rule.Id] = res
	}
	return results, nil
}

func persistResult(
	ctx context.Context,
	setter Setter,
	resultID uuid.UUID,
	rule oapi.PolicyRule,
	res *planvalidation.Result,
) error {
	ruleID, err := uuid.Parse(rule.Id)
	if err != nil {
		return fmt.Errorf("parse rule id: %w", err)
	}

	violations := make([]oapi.PlanValidationViolation, len(res.Denials))
	for i, msg := range res.Denials {
		violations[i] = oapi.PlanValidationViolation{Message: msg}
	}
	violationsJSON, err := json.Marshal(violations)
	if err != nil {
		return fmt.Errorf("marshal violations: %w", err)
	}

	return setter.UpsertPlanValidationResult(ctx, db.UpsertPlanValidationResultParams{
		ResultID:   resultID,
		RuleID:     ruleID,
		Passed:     res.Passed,
		Violations: violationsJSON,
	})
}
