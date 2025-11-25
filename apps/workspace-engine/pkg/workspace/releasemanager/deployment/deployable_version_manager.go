package deployment

import (
	"context"
	"fmt"
	"sort"
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

	return policies, nil
}

func (m *DeployableVersionManager) getEnvironment(ctx context.Context) (*oapi.Environment, error) {
	ctx, span := deployableVersionTracer.Start(ctx, "GetEnvironment")
	defer span.End()

	environment, ok := m.store.Environments.Get(m.releaseTarget.EnvironmentId)
	if !ok {
		err := fmt.Errorf("environment %s not found", m.releaseTarget.EnvironmentId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "environment not found")
		return nil, fmt.Errorf("environment %s not found", m.releaseTarget.EnvironmentId)
	}

	return environment, nil
}

func (m *DeployableVersionManager) getEvaluators(ctx context.Context, policies []*oapi.Policy) ([]evaluator.Evaluator, error) {
	ctx, span := deployableVersionTracer.Start(ctx, "GetEvaluators")
	defer span.End()

	evaluators := m.policyManager.PlannerGlobalEvaluators()

	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			policyEvaluators := m.policyManager.PlannerPolicyEvaluators(&rule)
			evaluators = append(evaluators, policyEvaluators...)
		}
	}

	sort.Slice(evaluators, func(i, j int) bool {
		return evaluators[i].Complexity() < evaluators[j].Complexity()
	})

	return evaluators, nil
}

func (m *DeployableVersionManager) filterBypassedEvaluators(evaluators []evaluator.Evaluator, versionId string) []evaluator.Evaluator {
	allBypasses := m.store.PolicyBypasses.GetAllForTarget(versionId, m.releaseTarget.EnvironmentId, m.releaseTarget.ResourceId)

	skippedRules := make(map[string]bool)
	for _, bypass := range allBypasses {
		skippedRules[bypass.RuleId] = true
	}

	filteredEvaluators := make([]evaluator.Evaluator, 0, len(evaluators))
	for _, evaluator := range evaluators {
		if _, ok := skippedRules[evaluator.RuleId()]; ok {
			continue
		}
		filteredEvaluators = append(filteredEvaluators, evaluator)
	}
	return filteredEvaluators
}

func (m *DeployableVersionManager) recordVersionBlockedToSpan(span oteltrace.Span, version *oapi.DeploymentVersion, evalIdx int, result *oapi.RuleEvaluation) {
	span.AddEvent("Version blocked by policy",
		oteltrace.WithAttributes(
			attribute.String("version.id", version.Id),
			attribute.String("version.tag", version.Tag),
			attribute.Int("evaluator_index", evalIdx),
			attribute.String("message", result.Message),
		))
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
		))
	defer span.End()

	policies, err := m.getPolicies(ctx)
	if err != nil {
		return nil
	}

	environment, err := m.getEnvironment(ctx)
	if err != nil {
		return nil
	}

	evaluators, err := m.getEvaluators(ctx, policies)
	if err != nil {
		return nil
	}

	scope := evaluator.EvaluatorScope{
		Environment:   environment,
		ReleaseTarget: m.releaseTarget,
	}

	var firstResults []*oapi.RuleEvaluation
	var firstVersion *oapi.DeploymentVersion

	for idx, version := range candidateVersions {
		eligible := true
		scope.Version = version
		results := make([]*oapi.RuleEvaluation, 0)

		filteredEvaluators := m.filterBypassedEvaluators(evaluators, version.Id)
		for evalIdx, eval := range filteredEvaluators {
			result := eval.Evaluate(ctx, scope)
			results = append(results, result)
			if !result.Allowed {
				eligible = false
				m.recordVersionBlockedToSpan(span, version, evalIdx, result)
				if result.NextEvaluationTime != nil {
					m.scheduler.Schedule(m.releaseTarget, *result.NextEvaluationTime)
				}
				break
			}
		}

		if idx == 0 {
			firstResults = results
			firstVersion = version
		}

		if eligible {
			m.recordAllowedVersionEvaluationsToPlanning(version, results)
			span.SetStatus(codes.Ok, "found deployable version")
			return version
		}
	}

	m.recordFirstVersionEvaluationsToPlanning(firstVersion, firstResults)
	span.SetStatus(codes.Ok, "no deployable version (all blocked)")
	return nil
}
