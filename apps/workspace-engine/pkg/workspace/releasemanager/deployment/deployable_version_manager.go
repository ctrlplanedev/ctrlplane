package deployment

import (
	"context"
	"fmt"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var deployableVersionTracer = otel.Tracer("DeployableVersionManager")

type DeployableVersionManager struct {
	store         *store.Store
	policyManager *policy.Manager
	scheduler     *ReconciliationScheduler
	releaseTarget *oapi.ReleaseTarget
	planning      *trace.PlanningPhase
}

func NewDeployableVersionManager(
	store *store.Store,
	policyManager *policy.Manager,
	scheduler *ReconciliationScheduler,
	releaseTarget *oapi.ReleaseTarget,
	planning *trace.PlanningPhase,
) *DeployableVersionManager {
	return &DeployableVersionManager{
		store:         store,
		policyManager: policyManager,
		scheduler:     scheduler,
		releaseTarget: releaseTarget,
		planning:      planning,
	}
}

func (m *DeployableVersionManager) getPolicies(ctx context.Context) ([]*oapi.Policy, error) {
	ctx, span := deployableVersionTracer.Start(ctx, "GetPolicies")
	defer span.End()

	policies, err := m.store.ReleaseTargets.GetPolicies(ctx, m.releaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get policies")
		return nil, err
	}

	span.SetAttributes(attribute.Int("policies.count", len(policies)))
	return policies, nil
}

func (m *DeployableVersionManager) getEnvironment(ctx context.Context) (*oapi.Environment, error) {
	_, span := deployableVersionTracer.Start(ctx, "GetEnvironment")
	defer span.End()

	environment, ok := m.store.Environments.Get(m.releaseTarget.EnvironmentId)
	if !ok {
		err := fmt.Errorf("environment %s not found", m.releaseTarget.EnvironmentId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "environment not found")
		return nil, err
	}

	return environment, nil
}

func (m *DeployableVersionManager) getEvaluators(ctx context.Context, policies []*oapi.Policy) ([]evaluator.Evaluator, error) {
	_, span := deployableVersionTracer.Start(ctx, "GetEvaluators")
	defer span.End()

	evaluators := m.policyManager.PlannerGlobalEvaluators()
	span.SetAttributes(attribute.Int("global_evaluators.count", len(evaluators)))

	enabledPolicies := 0
	totalRules := 0
	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		enabledPolicies++
		for _, rule := range p.Rules {
			totalRules++
			policyEvaluators := m.policyManager.PlannerPolicyEvaluators(&rule)
			evaluators = append(evaluators, policyEvaluators...)
		}
	}

	sort.Slice(evaluators, func(i, j int) bool {
		return evaluators[i].Complexity() < evaluators[j].Complexity()
	})

	span.SetAttributes(
		attribute.Int("enabled_policies.count", enabledPolicies),
		attribute.Int("rules.total", totalRules),
		attribute.Int("evaluators.total", len(evaluators)),
	)

	return evaluators, nil
}

// precomputeBypasses scans all policy skips once and returns a map from
// versionId to the set of skipped rule IDs for this release target's
// (environmentId, resourceId) pair. This replaces calling GetAllForTarget
// per candidate version, reducing O(N × S) to O(S) where N = candidate
// versions and S = total policy skips in the store.
func (m *DeployableVersionManager) precomputeBypasses(ctx context.Context) map[string]map[string]bool {
	_, span := deployableVersionTracer.Start(ctx, "PrecomputeBypasses")
	defer span.End()

	now := time.Now()
	envId := m.releaseTarget.EnvironmentId
	resId := m.releaseTarget.ResourceId

	result := make(map[string]map[string]bool)

	for _, skip := range m.store.PolicySkips.Items() {
		if skip.ExpiresAt != nil && skip.ExpiresAt.Before(now) {
			continue
		}

		// Match logic mirrors PolicySkips.GetAllForTarget:
		//   - environment exact match + (resource wildcard or exact match)
		//   - environment wildcard (nil) = full wildcard
		matched := false
		if skip.EnvironmentId != nil && *skip.EnvironmentId == envId {
			if skip.ResourceId == nil || *skip.ResourceId == resId {
				matched = true
			}
		} else if skip.EnvironmentId == nil {
			matched = true
		}

		if !matched {
			continue
		}

		if result[skip.VersionId] == nil {
			result[skip.VersionId] = make(map[string]bool)
		}
		result[skip.VersionId][skip.RuleId] = true
	}

	span.SetAttributes(attribute.Int("bypasses.versions_with_skips", len(result)))
	return result
}

// applyBypasses filters evaluators by removing those whose RuleId is in the
// skipped set. Returns the original slice unchanged (zero allocation) when
// no bypasses apply — the common case.
func (m *DeployableVersionManager) applyBypasses(evaluators []evaluator.Evaluator, skippedRules map[string]bool) []evaluator.Evaluator {
	if len(skippedRules) == 0 {
		return evaluators
	}

	filtered := make([]evaluator.Evaluator, 0, len(evaluators))
	for _, eval := range evaluators {
		if !skippedRules[eval.RuleId()] {
			filtered = append(filtered, eval)
		}
	}
	return filtered
}

func (m *DeployableVersionManager) recordAllowedVersionEvaluationsToPlanning(version *oapi.DeploymentVersion, results []*oapi.RuleEvaluation) {
	if m.planning == nil {
		return
	}

	for _, result := range results {
		evaluation := m.planning.StartEvaluation(result.Message)
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

func (m *DeployableVersionManager) recordFirstVersionEvaluationsToPlanning(version *oapi.DeploymentVersion, results []*oapi.RuleEvaluation) {
	if m.planning == nil || version == nil {
		return
	}

	for _, result := range results {
		evaluation := m.planning.StartEvaluation(result.Message)
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
		r := trace.ResultBlocked
		if result.Allowed {
			r = trace.ResultAllowed
		}
		evaluation.SetResult(r, result.Message).End()
	}
}

func (m *DeployableVersionManager) Find(ctx context.Context, candidateVersions []*oapi.DeploymentVersion) *oapi.DeploymentVersion {
	ctx, span := deployableVersionTracer.Start(ctx, "FindDeployableVersion",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", m.releaseTarget.Key()),
			attribute.Int("candidate_versions.count", len(candidateVersions)),
		))
	defer span.End()

	if len(candidateVersions) == 0 {
		span.SetStatus(codes.Ok, "no candidate versions")
		return nil
	}

	policies, err := m.getPolicies(ctx)
	if err != nil {
		return nil
	}
	span.SetAttributes(attribute.Int("policies.count", len(policies)))

	environment, err := m.getEnvironment(ctx)
	if err != nil {
		return nil
	}

	resource, _ := m.store.Resources.Get(m.releaseTarget.ResourceId)
	deployment, _ := m.store.Deployments.Get(m.releaseTarget.DeploymentId)

	evaluators, err := m.getEvaluators(ctx, policies)
	if err != nil {
		return nil
	}

	evaluatorTypes := make([]string, len(evaluators))
	for i, eval := range evaluators {
		evaluatorTypes[i] = eval.RuleType()
	}
	span.SetAttributes(
		attribute.Int("evaluators.count", len(evaluators)),
		attribute.StringSlice("evaluators.types", evaluatorTypes),
	)

	// Pre-compute all policy skip rule IDs indexed by version ID in a single
	// pass over the store, rather than scanning all skips per candidate version.
	bypassesByVersion := m.precomputeBypasses(ctx)
	span.SetAttributes(attribute.Int("bypasses.versions_with_skips", len(bypassesByVersion)))

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Resource:    resource,
		Deployment:  deployment,
	}

	var firstResults []*oapi.RuleEvaluation
	var firstVersion *oapi.DeploymentVersion

	result := m.evaluateVersions(ctx, candidateVersions, evaluators, bypassesByVersion, scope, &firstResults, &firstVersion)
	if result != nil {
		return result
	}

	m.recordFirstVersionEvaluationsToPlanning(firstVersion, firstResults)
	span.SetStatus(codes.Ok, "no deployable version (all blocked)")
	return nil
}

func (m *DeployableVersionManager) evaluateVersions(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	evaluators []evaluator.Evaluator,
	bypassesByVersion map[string]map[string]bool,
	scope evaluator.EvaluatorScope,
	firstResults *[]*oapi.RuleEvaluation,
	firstVersion **oapi.DeploymentVersion,
) *oapi.DeploymentVersion {
	ctx, span := deployableVersionTracer.Start(ctx, "EvaluateVersions",
		oteltrace.WithAttributes(
			attribute.Int("candidate_versions.count", len(candidateVersions)),
			attribute.Int("evaluators.count", len(evaluators)),
		))
	defer span.End()

	for idx, version := range candidateVersions {
		scope.Version = version
		activeEvaluators := m.applyBypasses(evaluators, bypassesByVersion[version.Id])

		eligible, results := m.evaluateVersion(ctx, version, idx, activeEvaluators, scope)

		if idx == 0 {
			*firstResults = results
			*firstVersion = version
		}

		if eligible {
			m.recordAllowedVersionEvaluationsToPlanning(version, results)
			span.SetAttributes(attribute.Int("versions.evaluated", idx+1))
			span.SetStatus(codes.Ok, "found deployable version")
			return version
		}
	}

	span.SetAttributes(attribute.Int("versions.evaluated", len(candidateVersions)))
	return nil
}

func (m *DeployableVersionManager) evaluateVersion(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	versionIdx int,
	activeEvaluators []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) (bool, []*oapi.RuleEvaluation) {
	_, versionSpan := deployableVersionTracer.Start(ctx, "EvaluateVersion",
		oteltrace.WithAttributes(
			attribute.String("version.id", version.Id),
			attribute.String("version.tag", version.Tag),
			attribute.Int("version.index", versionIdx),
			attribute.Int("evaluators.active", len(activeEvaluators)),
		))
	defer versionSpan.End()

	results := make([]*oapi.RuleEvaluation, 0, len(activeEvaluators))

	for evalIdx, eval := range activeEvaluators {
		result := m.runEvaluator(ctx, eval, evalIdx, scope)
		results = append(results, result)

		if !result.Allowed {
			versionSpan.SetAttributes(
				attribute.Int("evaluators.run", evalIdx+1),
				attribute.String("blocked_by.type", eval.RuleType()),
				attribute.String("blocked_by.rule_id", eval.RuleId()),
				attribute.String("blocked_by.message", result.Message),
			)
			versionSpan.SetStatus(codes.Ok, "blocked")
			if result.NextEvaluationTime != nil {
				m.scheduler.Schedule(m.releaseTarget, *result.NextEvaluationTime)
			}
			return false, results
		}
	}

	versionSpan.SetAttributes(attribute.Int("evaluators.run", len(activeEvaluators)))
	versionSpan.SetStatus(codes.Ok, "eligible")
	return true, results
}

func (m *DeployableVersionManager) runEvaluator(
	ctx context.Context,
	eval evaluator.Evaluator,
	evalIdx int,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	_, evalSpan := deployableVersionTracer.Start(ctx, "RunEvaluator",
		oteltrace.WithAttributes(
			attribute.Int("evaluator.index", evalIdx),
			attribute.String("evaluator.type", eval.RuleType()),
			attribute.String("evaluator.rule_id", eval.RuleId()),
		))
	defer evalSpan.End()

	result := eval.Evaluate(ctx, scope)

	evalSpan.SetAttributes(
		attribute.Bool("result.allowed", result.Allowed),
		attribute.String("result.message", result.Message),
	)

	if result.Allowed {
		evalSpan.SetStatus(codes.Ok, "allowed")
	} else {
		evalSpan.SetStatus(codes.Ok, "blocked")
	}

	return result
}
