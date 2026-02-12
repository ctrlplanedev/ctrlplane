package deploymentdependency

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("DeploymentDependencyEvaluator")

type DeploymentDependencyEvaluator struct {
	store  *store.Store
	ruleId string
	rule   *oapi.DeploymentDependencyRule
}

func NewEvaluator(store *store.Store, dependencyRule *oapi.PolicyRule) evaluator.Evaluator {
	if dependencyRule == nil || dependencyRule.DeploymentDependency == nil || store == nil {
		return nil
	}

	return evaluator.WithMemoization(&DeploymentDependencyEvaluator{
		store:  store,
		ruleId: dependencyRule.Id,
		rule:   dependencyRule.DeploymentDependency,
	})
}

func (e *DeploymentDependencyEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeReleaseTarget
}

func (e *DeploymentDependencyEvaluator) RuleType() string {
	return "deploymentDependency"
}

func (e *DeploymentDependencyEvaluator) RuleId() string {
	return e.ruleId
}

func (e *DeploymentDependencyEvaluator) Complexity() int {
	return 3
}

func (e *DeploymentDependencyEvaluator) findMatchingDeployments(ctx context.Context) ([]*oapi.Deployment, error) {
	deploymentSelector := e.rule.DependsOnDeploymentSelector
	matchingDeployments := make([]*oapi.Deployment, 0)
	for _, deployment := range e.store.Deployments.Items() {
		matched, err := selector.Match(ctx, &deploymentSelector, deployment)
		if err != nil {
			return nil, fmt.Errorf("failed to match deployment selector: %w", err)
		}
		if matched {
			matchingDeployments = append(matchingDeployments, deployment)
		}
	}
	return matchingDeployments, nil
}

func (e *DeploymentDependencyEvaluator) getUpstreamReleaseTargets(ctx context.Context, matchingDeployments []*oapi.Deployment, resourceID string) []*oapi.ReleaseTarget {
	upstreamReleaseTargets := make([]*oapi.ReleaseTarget, 0, len(matchingDeployments))
	resourceTargets := e.store.ReleaseTargets.GetForResource(ctx, resourceID)
	deploymentToTargetMap := make(map[string]*oapi.ReleaseTarget)

	for _, resourceTarget := range resourceTargets {
		deploymentToTargetMap[resourceTarget.DeploymentId] = resourceTarget
	}

	for _, matchingDeployment := range matchingDeployments {
		if target, ok := deploymentToTargetMap[matchingDeployment.Id]; ok {
			upstreamReleaseTargets = append(upstreamReleaseTargets, target)
		}
	}

	return upstreamReleaseTargets
}

func (e *DeploymentDependencyEvaluator) checkUpstreamTargetHasSuccessfulRelease(upstreamReleaseTarget *oapi.ReleaseTarget) bool {
	latestJob := e.store.Jobs.GetLatestCompletedJobForReleaseTarget(upstreamReleaseTarget)
	if latestJob == nil {
		return false
	}

	return latestJob.Status == oapi.JobStatusSuccessful && latestJob.CompletedAt != nil
}

func (e *DeploymentDependencyEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "DeploymentDependencyEvaluator.Evaluate")
	defer span.End()

	deploymentSelector := e.rule.DependsOnDeploymentSelector
	span.SetAttributes(
		attribute.String("deployment.id", scope.Deployment.Id),
		attribute.String("resource.id", scope.Resource.Id),
	)

	matchingDeployments, err := e.findMatchingDeployments(ctx)
	if err != nil {
		span.RecordError(err)
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: failed to find matching deployments: %v", err),
		).WithDetail("error", err.Error()).WithDetail("deployment_id", scope.Deployment.Id)
	}

	if len(matchingDeployments) == 0 {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: no matching deployments found for selector: %v", deploymentSelector),
		).WithDetail("deployment_selector", deploymentSelector)
	}

	upstreamReleaseTargets := e.getUpstreamReleaseTargets(ctx, matchingDeployments, scope.Resource.Id)
	if len(upstreamReleaseTargets) != cap(upstreamReleaseTargets) {
		return results.NewDeniedResult(
			fmt.Sprintf("Deployment dependency: some upstream release targets not found for resource: %v", scope.Resource.Id),
		).WithDetail("deployment_selector", deploymentSelector)
	}

	for _, upstreamReleaseTarget := range upstreamReleaseTargets {
		if !e.checkUpstreamTargetHasSuccessfulRelease(upstreamReleaseTarget) {
			return results.NewDeniedResult(
				fmt.Sprintf("Deployment dependency: upstream release target %s has no successful release", upstreamReleaseTarget.Key()),
			).WithDetail("upstream_release_target_key", upstreamReleaseTarget.Key())
		}
	}

	return results.NewAllowedResult("Deployment dependency: all upstream release targets have successful releases")
}
