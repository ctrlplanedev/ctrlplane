package versionselector

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/versionselector")

// Evaluator evaluates version selector rules using CEL expressions.
// It provides bidirectional filtering between versions and release targets.
type Evaluator struct {
	store *store.Store
	rule  *oapi.VersionSelectorRule
}

// NewEvaluator creates a new version selector evaluator.
// Returns nil if the rule or store is nil.
func NewEvaluator(store *store.Store, rule *oapi.VersionSelectorRule) evaluator.Evaluator {
	if rule == nil || store == nil {
		return nil
	}

	return evaluator.WithMemoization(&Evaluator{
		store: store,
		rule:  rule,
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

// Evaluate evaluates the version selector rule against the given scope.
// It checks if the version matches the selector criteria for the target release target.
func (e *Evaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "VersionSelectorEvaluator.Evaluate",
		trace.WithAttributes(
			attribute.String("version.id", scope.Version.Id),
			attribute.String("version.tag", scope.Version.Tag),
			attribute.String("environment.id", scope.Environment.Id),
			attribute.String("environment.name", scope.Environment.Name),
			attribute.String("release_target.key", scope.ReleaseTarget.Key()),
		))
	defer span.End()

	// Get deployment and resource from store
	deployment, ok := e.store.Deployments.Get(scope.ReleaseTarget.DeploymentId)
	if !ok {
		err := fmt.Errorf("deployment %s not found", scope.ReleaseTarget.DeploymentId)
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: deployment not found: %s", scope.ReleaseTarget.DeploymentId),
		).WithDetail("error", err.Error())
	}

	resource, ok := e.store.Resources.Get(scope.ReleaseTarget.ResourceId)
	if !ok {
		err := fmt.Errorf("resource %s not found", scope.ReleaseTarget.ResourceId)
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: resource not found: %s", scope.ReleaseTarget.ResourceId),
		).WithDetail("error", err.Error())
	}

	// Try to extract CEL selector first
	celSelector, celErr := e.rule.Selector.AsCelSelector()
	if celErr == nil {
		return e.evaluateCEL(ctx, scope, deployment, resource, celSelector, span)
	}

	// Try to extract JSON selector
	jsonSelector, jsonErr := e.rule.Selector.AsJsonSelector()
	if jsonErr == nil {
		return e.evaluateJSON(ctx, scope, deployment, resource, jsonSelector, span)
	}

	// Failed to parse selector
	return results.NewDeniedResult(
		fmt.Sprintf("Version selector: failed to parse selector: cel error: %v, json error: %v", celErr, jsonErr),
	).
		WithDetail("celError", celErr.Error()).
		WithDetail("jsonError", jsonErr.Error())
}

// evaluateCEL evaluates a CEL-based selector
func (e *Evaluator) evaluateCEL(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
	deployment *oapi.Deployment,
	resource *oapi.Resource,
	celSelector oapi.CelSelector,
	span trace.Span,
) *oapi.RuleEvaluation {
	celExpression := celSelector.Cel
	span.SetAttributes(attribute.String("selector.type", "cel"))
	span.SetAttributes(attribute.String("selector.expression", celExpression))

	// Compile CEL expression
	program, err := compile(celExpression)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to compile CEL expression: %v", err),
		).
			WithDetail("error", err.Error()).
			WithDetail("expression", celExpression)
	}

	// Build CEL context
	versionMap, err := entityToMap(scope.Version)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert version to map: %v", err),
		).WithDetail("error", err.Error())
	}

	environmentMap, err := entityToMap(scope.Environment)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert environment to map: %v", err),
		).WithDetail("error", err.Error())
	}

	resourceMap, err := entityToMap(resource)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to convert resource to map: %v", err),
		).WithDetail("error", err.Error())
	}

	deploymentMap, err := entityToMap(deployment)
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
			WithDetail("expression", celExpression)
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
			WithDetail("expression", celExpression).
			WithDetail("version_id", scope.Version.Id).
			WithDetail("version_tag", scope.Version.Tag)
	}

	span.AddEvent("Version allowed by selector",
		trace.WithAttributes(
			attribute.Bool("selector.result", true),
		))

	return results.NewAllowedResult("Version selector: version matches selector").
		WithDetail("expression", celExpression).
		WithDetail("version_id", scope.Version.Id).
		WithDetail("version_tag", scope.Version.Tag)
}

// evaluateJSON evaluates a JSON-based selector
func (e *Evaluator) evaluateJSON(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
	deployment *oapi.Deployment,
	resource *oapi.Resource,
	jsonSelector oapi.JsonSelector,
	span trace.Span,
) *oapi.RuleEvaluation {
	span.SetAttributes(attribute.String("selector.type", "json"))

	// Use the existing selector matching logic
	matched, err := selector.Match(ctx, &e.rule.Selector, scope.Version)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Version selector: failed to evaluate JSON selector: %v", err),
		).WithDetail("error", err.Error())
	}

	if !matched {
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
			WithDetail("version_id", scope.Version.Id).
			WithDetail("version_tag", scope.Version.Tag)
	}

	span.AddEvent("Version allowed by selector",
		trace.WithAttributes(
			attribute.Bool("selector.result", true),
		))

	return results.NewAllowedResult("Version selector: version matches selector").
		WithDetail("version_id", scope.Version.Id).
		WithDetail("version_tag", scope.Version.Tag)
}

// getDescription returns a user-friendly description of the selector
func (e *Evaluator) getDescription() string {
	if e.rule.Description != nil && strings.TrimSpace(*e.rule.Description) != "" {
		return *e.rule.Description
	}

	// Try to extract CEL expression
	if celSelector, err := e.rule.Selector.AsCelSelector(); err == nil {
		return fmt.Sprintf("CEL: %s", celSelector.Cel)
	}

	return "version selector"
}
