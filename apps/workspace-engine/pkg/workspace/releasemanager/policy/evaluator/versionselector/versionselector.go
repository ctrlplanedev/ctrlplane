package versionselector

import (
	"context"
	"fmt"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/versionselector")

// Evaluator evaluates version selector rules using CEL expressions.
// It provides bidirectional filtering between versions and release targets.
type Evaluator struct {
	ruleId string
	rule   *oapi.VersionSelectorRule
}

// NewEvaluator creates a new version selector evaluator.
// Returns nil if the rule or store is nil.
func NewEvaluator(versionSelectorRule *oapi.PolicyRule) evaluator.Evaluator {
	if versionSelectorRule == nil || versionSelectorRule.VersionSelector == nil {
		return nil
	}

	return evaluator.WithMemoization(&Evaluator{
		ruleId: versionSelectorRule.Id,
		rule:   versionSelectorRule.VersionSelector,
	})
}

// ScopeFields declares that this evaluator needs Version, Environment, and ReleaseTarget.
func (e *Evaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion | evaluator.ScopeEnvironment | evaluator.ScopeReleaseTarget
}

// RuleType returns the rule type identifier for bypass matching.
func (e *Evaluator) RuleType() string {
	return "versionSelector"
}

func (e *Evaluator) RuleId() string {
	return e.ruleId
}

func (e *Evaluator) Complexity() int {
	return 1
}

// Evaluate evaluates the version selector rule against the given scope.
// It checks if the version matches the selector criteria for the target release target.
func (e *Evaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "VersionSelectorEvaluator.Evaluate",
		trace.WithAttributes(
			attribute.String("version.id", scope.Version.Id),
			attribute.String("version.tag", scope.Version.Tag),
			attribute.String("environment.id", scope.Environment.Id),
			attribute.String("environment.name", scope.Environment.Name),
			attribute.String("release_target.key", scope.ReleaseTarget().Key()),
		))
	defer span.End()

	deployment := scope.Deployment
	resource := scope.Resource

	// Try to extract CEL selector first
	celSelector := e.rule.Selector
	if celSelector != "" {
		return e.evaluateCEL(scope, deployment, resource, celSelector, span)
	}

	return results.NewDeniedResult(
		"Version selector: selector is required but was empty",
	).
		WithDetail("selector", celSelector)
}

// evaluateCEL evaluates a CEL-based selector.
func (e *Evaluator) evaluateCEL(
	scope evaluator.EvaluatorScope,
	deployment *oapi.Deployment,
	resource *oapi.Resource,
	celSelector string,
	span trace.Span,
) *oapi.RuleEvaluation {
	span.SetAttributes(attribute.String("selector.type", "cel"))
	span.SetAttributes(attribute.String("selector.expression", celSelector))

	// Compile CEL expression
	program, err := compile(celSelector)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to compile CEL expression: %v", err),
		).
			WithDetail("error", err.Error()).
			WithDetail("expression", celSelector)
	}

	// Build CEL context
	versionMap, err := celutil.EntityToMap(scope.Version)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert version to map: %v", err),
		).WithDetail("error", err.Error())
	}

	environmentMap, err := celutil.EntityToMap(scope.Environment)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert environment to map: %v", err),
		).WithDetail("error", err.Error())
	}

	resourceMap, err := celutil.EntityToMap(resource)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert resource to map: %v", err),
		).WithDetail("error", err.Error())
	}

	deploymentMap, err := celutil.EntityToMap(deployment)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert deployment to map: %v", err),
		).WithDetail("error", err.Error())
	}

	celCtx := map[string]any{
		"version":     versionMap,
		"environment": environmentMap,
		"resource":    resourceMap,
		"deployment":  deploymentMap,
	}

	// Evaluate CEL expression
	result, err := evaluate(program, celCtx)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: CEL evaluation failed: %v", err),
		).
			WithDetail("error", err.Error()).
			WithDetail("expression", celSelector)
	}

	if !result {
		description := "Version does not match selector"
		if e.rule.Description != nil && *e.rule.Description != "" {
			description = *e.rule.Description
		}

		span.AddEvent("Version blocked by selector",
			trace.WithAttributes(
				attribute.Bool("selector.result", false),
			))

		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: %s", description),
		).
			WithDetail("expression", celSelector).
			WithDetail("version_id", scope.Version.Id).
			WithDetail("version_tag", scope.Version.Tag)
	}

	span.AddEvent("Version allowed by selector",
		trace.WithAttributes(
			attribute.Bool("selector.result", true),
		))

	return results.NewAllowedResult("Version selector: version matches selector").
		WithDetail("expression", celSelector).
		WithDetail("version_id", scope.Version.Id).
		WithDetail("version_tag", scope.Version.Tag)
}
