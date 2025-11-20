package deployment

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// checkPolicyBypass looks for the most specific bypass matching the given version and release target.
// Returns nil if no active bypass is found.
func (p *Planner) checkPolicyBypass(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) *oapi.PolicyBypass {
	return p.store.PolicyBypasses.GetForTarget(
		version.Id,
		releaseTarget.EnvironmentId,
		releaseTarget.ResourceId,
	)
}

// filterBypassedEvaluators removes evaluators whose rule types are bypassed.
// If policyId is provided, only bypasses that match that policy are considered.
// Returns the filtered list of evaluators.
func (p *Planner) filterBypassedEvaluators(
	evaluators []evaluator.Evaluator,
	bypass *oapi.PolicyBypass,
	policyId string,
) []evaluator.Evaluator {
	if bypass == nil {
		return evaluators
	}

	// Check if this bypass applies to the given policy
	if !bypass.MatchesPolicy(policyId) {
		return evaluators
	}

	filtered := make([]evaluator.Evaluator, 0, len(evaluators))
	for _, eval := range evaluators {
		// Check if this evaluator's rule type is bypassed
		if bypass.BypassesRuleType(eval.RuleType()) {
			// Skip this evaluator - it's bypassed
			continue
		}
		filtered = append(filtered, eval)
	}

	return filtered
}

func (p *Planner) collectPolicyEvaluators(
	policies []*oapi.Policy,
	bypass *oapi.PolicyBypass,
) []evaluator.Evaluator {
	var evaluators []evaluator.Evaluator
	for _, policy := range policies {
		// Skip disabled policies
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			policyEvaluators := p.policyManager.PlannerPolicyEvaluators(&rule)
			// Filter evaluators for this specific policy
			policyEvaluators = p.filterBypassedEvaluators(policyEvaluators, bypass, policy.Id)
			evaluators = append(evaluators, policyEvaluators...)
		}
	}
	return evaluators
}

func (p *Planner) partitionEvalsByVersionDependence(
	scope evaluator.EvaluatorScope,
	evaluators []evaluator.Evaluator,
) ([]evaluator.Evaluator, []evaluator.Evaluator) {
	versionIndependentEvals := make([]evaluator.Evaluator, 0, len(evaluators))
	versionDependentEvals := make([]evaluator.Evaluator, 0, len(evaluators))

	for _, eval := range evaluators {
		scopeFields := eval.ScopeFields()

		needsVersion := scopeFields&evaluator.ScopeVersion != 0

		if needsVersion {
			versionDependentEvals = append(versionDependentEvals, eval)
			continue
		}

		if scope.HasFields(scopeFields) {
			versionIndependentEvals = append(versionIndependentEvals, eval)
		}
	}

	return versionIndependentEvals, versionDependentEvals
}

func (p *Planner) evaluateVersionIndependentEval(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
	eval evaluator.Evaluator,
	releaseTarget *oapi.ReleaseTarget,
	planning *trace.PlanningPhase,
) bool {
	result := eval.Evaluate(ctx, scope)

	if planning != nil {
		evaluation := planning.StartEvaluation(result.Message)
		if result.Allowed {
			evaluation.SetResult(trace.ResultAllowed, result.Message).End()
		}

		if !result.Allowed {
			evaluation.SetResult(trace.ResultBlocked, result.Message).End()
		}
	}

	if !result.Allowed {
		if result.NextEvaluationTime != nil {
			p.scheduler.Schedule(releaseTarget, *result.NextEvaluationTime)
		}
		return false
	}

	return true
}

// evaluateSingleVersionAgainstDependentPolicies evaluates a single version against all version-dependent evaluators.
// Returns whether the version is eligible and the evaluation results.
func (p *Planner) evaluateSingleVersionAgainstDependentPolicies(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	versionDependentEvals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
	releaseTarget *oapi.ReleaseTarget,
	span oteltrace.Span,
	versionsBlocked *int,
) (bool, []*oapi.RuleEvaluation) {
	eligible := true
	scope.Version = version
	var results []*oapi.RuleEvaluation

	for evalIdx, eval := range versionDependentEvals {
		result := eval.Evaluate(ctx, scope)
		results = append(results, result)

		if !result.Allowed {
			eligible = false
			*versionsBlocked++

			span.AddEvent("Version blocked by policy",
				oteltrace.WithAttributes(
					attribute.String("version.id", version.Id),
					attribute.String("version.tag", version.Tag),
					attribute.Int("evaluator_index", evalIdx),
					attribute.String("message", result.Message),
				))

			if result.NextEvaluationTime != nil {
				p.scheduler.Schedule(releaseTarget, *result.NextEvaluationTime)
			}

			break
		}
	}

	return eligible, results
}

// recordAllowedVersionEvaluationsToPlanning records the evaluation results for an allowed version to the planning trace.
func (p *Planner) recordAllowedVersionEvaluationsToPlanning(
	planning *trace.PlanningPhase,
	version *oapi.DeploymentVersion,
	results []*oapi.RuleEvaluation,
) {
	if planning == nil {
		return
	}

	for _, result := range results {
		evaluation := planning.StartEvaluation(result.Message)
		display := version.Name
		if display == "" {
			display = version.Tag
		}
		evaluation.SetAttributes(
			attribute.String("ctrlplane.group_by", version.Id),
			attribute.String("ctrlplane.group_by_name", display),
			attribute.String("ctrlplane.version_id", version.Id),
			attribute.String("ctrlplane.version_name", version.Name),
			attribute.String("ctrlplane.version_tag", version.Tag),
		)
		evaluation.SetResult(trace.ResultAllowed, result.Message).End()
	}
}

// recordFirstVersionEvaluationsToPlanning records the evaluation results for the first version to the planning trace.
// This is called when no versions are eligible to show why the first version was blocked.
func (p *Planner) recordFirstVersionEvaluationsToPlanning(
	planning *trace.PlanningPhase,
	firstVersion *oapi.DeploymentVersion,
	firstResults []*oapi.RuleEvaluation,
) {
	if planning == nil || firstVersion == nil {
		return
	}

	for _, result := range firstResults {
		evaluation := planning.StartEvaluation(result.Message)
		display := firstVersion.Name
		if display == "" {
			display = firstVersion.Tag
		}
		evaluation.SetAttributes(
			attribute.String("ctrlplane.group_by", firstVersion.Id),
			attribute.String("ctrlplane.group_by_name", display),
			attribute.String("ctrlplane.version_id", firstVersion.Id),
			attribute.String("ctrlplane.version_name", firstVersion.Name),
			attribute.String("ctrlplane.version_tag", firstVersion.Tag),
		)
		r := trace.ResultBlocked
		if result.Allowed {
			r = trace.ResultAllowed
		}
		evaluation.SetResult(r, result.Message).End()
	}
}

// findDeployableVersion finds the first version that passes all checks (READ-ONLY).
// Checks include:
//   - System-level version checks (e.g., version status via evaluators)
//   - User-defined policies (approval requirements, environment progression, etc.)
//
// Returns nil if all versions are blocked by policies or system checks.
func (p *Planner) findDeployableVersion(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
	planning *trace.PlanningPhase,
) *oapi.DeploymentVersion {
	ctx, span := tracer.Start(ctx, "findDeployableVersion",
		oteltrace.WithAttributes(
			attribute.Int("candidate_versions.count", len(candidateVersions)),
		))
	defer span.End()

	policies, err := p.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get policies")
		return nil
	}

	environment, ok := p.store.Environments.Get(releaseTarget.EnvironmentId)
	if !ok {
		err := fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "environment not found")
		return nil
	}

	// Check for policy bypass ONCE upfront (independent of version)
	// We'll use the first candidate version to check for bypass, as bypasses are version-scoped
	var bypass *oapi.PolicyBypass
	if len(candidateVersions) > 0 {
		bypass = p.checkPolicyBypass(ctx, candidateVersions[0], releaseTarget)
		if bypass != nil {
			span.AddEvent("Policy bypass active",
				oteltrace.WithAttributes(
					attribute.String("bypass.id", bypass.Id),
					attribute.String("bypass.justification", bypass.Justification),
					attribute.String("bypass.created_by", bypass.CreatedBy),
				))
		}
	}

	evaluators := p.policyManager.PlannerGlobalEvaluators()

	// Filter global evaluators by bypass (no specific policy, so pass empty string)
	evaluators = p.filterBypassedEvaluators(evaluators, bypass, "")

	policyEvaluators := p.collectPolicyEvaluators(policies, bypass)
	evaluators = append(evaluators, policyEvaluators...)

	sort.Slice(evaluators, func(i, j int) bool {
		return evaluators[i].Complexity() < evaluators[j].Complexity()
	})

	scope := evaluator.EvaluatorScope{
		Environment:   environment,
		ReleaseTarget: releaseTarget,
	}

	versionIndependentEvals, versionDependentEvals := p.partitionEvalsByVersionDependence(scope, evaluators)

	span.SetAttributes(
		attribute.Int("evaluators.version_independent", len(versionIndependentEvals)),
		attribute.Int("evaluators.version_dependent", len(versionDependentEvals)),
	)

	// Now check version-independent evaluators once upfront
	span.AddEvent("Evaluating version-independent policies")
	for _, eval := range versionIndependentEvals {
		isAllowed := p.evaluateVersionIndependentEval(ctx, scope, eval, releaseTarget, planning)
		if !isAllowed {
			return nil
		}
	}

	versionsEvaluated := 0
	versionsBlocked := 0

	var firstResults []*oapi.RuleEvaluation
	var firstVersion *oapi.DeploymentVersion
	for idx, version := range candidateVersions {
		if idx == 0 {
			firstVersion = version
		}
		versionsEvaluated++

		eligible, results := p.evaluateSingleVersionAgainstDependentPolicies(
			ctx,
			version,
			versionDependentEvals,
			scope,
			releaseTarget,
			span,
			&versionsBlocked,
		)

		if idx == 0 {
			firstResults = results
		}

		if eligible {
			p.recordAllowedVersionEvaluationsToPlanning(planning, version, results)
			span.SetStatus(codes.Ok, "found deployable version")
			return version
		}
	}

	p.recordFirstVersionEvaluationsToPlanning(planning, firstVersion, firstResults)

	span.SetStatus(codes.Ok, "no deployable version (all blocked)")
	return nil
}
