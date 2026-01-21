package environmentprogression

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var actionTracer = otel.Tracer("EnvironmentProgressionAction")

type ReconcileFn func(ctx context.Context, targets []*oapi.ReleaseTarget) error

type EnvironmentProgressionAction struct {
	store       *store.Store
	reconcileFn ReconcileFn
}

func NewEnvironmentProgressionAction(store *store.Store, reconcileFn ReconcileFn) *EnvironmentProgressionAction {
	return &EnvironmentProgressionAction{
		store:       store,
		reconcileFn: reconcileFn,
	}
}

func (a *EnvironmentProgressionAction) Name() string {
	return "environmentprogression"
}

func (a *EnvironmentProgressionAction) Execute(ctx context.Context, trigger action.ActionTrigger, actx action.ActionContext) error {
	ctx, span := actionTracer.Start(ctx, "EnvironmentProgressionAction.Execute")
	defer span.End()

	span.SetAttributes(
		attribute.String("trigger", string(trigger)),
		attribute.String("release.id", actx.Release.ID()),
		attribute.String("job.id", actx.Job.Id),
		attribute.String("job.status", string(actx.Job.Status)),
	)
	if trigger != action.TriggerJobSuccess {
		return nil
	}

	environment := a.getEnvironment(actx.Release.ReleaseTarget.EnvironmentId)
	if environment == nil {
		return nil
	}

	progressionDependentPolicies, err := a.getProgressionDependentPolicies(ctx, environment)
	if err != nil {
		return fmt.Errorf("failed to get progression dependent policies: %w", err)
	}

	if len(progressionDependentPolicies) == 0 {
		return nil
	}

	version := &actx.Release.Version
	policiesThatCrossedThreshold := a.filterPoliciesWhereThresholdJustCrossed(
		ctx, environment, version, actx.Job, progressionDependentPolicies,
	)

	if len(policiesThatCrossedThreshold) == 0 {
		return nil
	}

	deploymentId := actx.Release.ReleaseTarget.DeploymentId
	progressionDependentTargets, err := a.getProgressionDependentTargets(ctx, policiesThatCrossedThreshold, deploymentId)
	if err != nil {
		return fmt.Errorf("failed to get progression dependent targets: %w", err)
	}

	if len(progressionDependentTargets) == 0 {
		return nil
	}

	return a.reconcileFn(ctx, progressionDependentTargets)
}

func (a *EnvironmentProgressionAction) getEnvironment(envId string) *oapi.Environment {
	env, ok := a.store.Environments.Get(envId)
	if !ok {
		return nil
	}
	return env
}

func (a *EnvironmentProgressionAction) getProgressionDependentPolicies(ctx context.Context, environment *oapi.Environment) ([]*oapi.Policy, error) {
	policies := make([]*oapi.Policy, 0)
	for _, policy := range a.store.Policies.Items() {
		for _, rule := range policy.Rules {
			if rule.EnvironmentProgression == nil {
				continue
			}

			dependsOnSelector := rule.EnvironmentProgression.DependsOnEnvironmentSelector

			matched, err := selector.Match(ctx, &dependsOnSelector, *environment)
			if err != nil {
				return nil, fmt.Errorf("failed to match selector: %w", err)
			}

			if matched {
				policies = append(policies, policy)
			}

			break
		}
	}

	return policies, nil
}

func (a *EnvironmentProgressionAction) getProgressionDependentTargets(ctx context.Context, policies []*oapi.Policy, deploymentId string) ([]*oapi.ReleaseTarget, error) {
	targetMap := make(map[string]*oapi.ReleaseTarget)

	deploymentTargets, err := a.store.ReleaseTargets.GetForDeployment(ctx, deploymentId)
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment targets: %w", err)
	}

	for _, target := range deploymentTargets {
		environment, ok := a.store.Environments.Get(target.EnvironmentId)
		if !ok {
			continue
		}
		resource, ok := a.store.Resources.Get(target.ResourceId)
		if !ok {
			continue
		}
		deployment, ok := a.store.Deployments.Get(target.DeploymentId)
		if !ok {
			continue
		}

		for _, policy := range policies {
			if selector.MatchPolicy(ctx, policy, selector.NewResolvedReleaseTarget(environment, deployment, resource)) {
				targetMap[target.Key()] = target
			}
		}
	}

	targetList := make([]*oapi.ReleaseTarget, 0, len(targetMap))
	for _, target := range targetMap {
		targetList = append(targetList, target)
	}
	return targetList, nil
}

func (a *EnvironmentProgressionAction) filterPoliciesWhereThresholdJustCrossed(
	ctx context.Context,
	dependencyEnv *oapi.Environment,
	version *oapi.DeploymentVersion,
	job *oapi.Job,
	policies []*oapi.Policy,
) []*oapi.Policy {
	result := make([]*oapi.Policy, 0)

	for _, policy := range policies {
		rule := a.getEnvironmentProgressionRule(policy)
		if rule == nil {
			continue
		}

		if a.didThresholdJustCross(ctx, dependencyEnv, version, job, rule) {
			result = append(result, policy)
		}
	}

	return result
}

func (a *EnvironmentProgressionAction) getEnvironmentProgressionRule(policy *oapi.Policy) *oapi.EnvironmentProgressionRule {
	for _, rule := range policy.Rules {
		if rule.EnvironmentProgression != nil {
			return rule.EnvironmentProgression
		}
	}
	return nil
}

func (a *EnvironmentProgressionAction) didThresholdJustCross(
	ctx context.Context,
	dependencyEnv *oapi.Environment,
	version *oapi.DeploymentVersion,
	job *oapi.Job,
	rule *oapi.EnvironmentProgressionRule,
) bool {
	if job.CompletedAt == nil {
		return false
	}

	successStatuses := map[oapi.JobStatus]bool{oapi.JobStatusSuccessful: true}
	if rule.SuccessStatuses != nil {
		successStatuses = make(map[oapi.JobStatus]bool)
		for _, status := range *rule.SuccessStatuses {
			successStatuses[status] = true
		}
	}

	var minPercentage float32 = 0.0
	if rule.MinimumSuccessPercentage != nil {
		minPercentage = *rule.MinimumSuccessPercentage
	}

	tracker := NewReleaseTargetJobTracker(ctx, a.store, dependencyEnv, version, successStatuses)

	if len(tracker.ReleaseTargets) == 0 {
		return false
	}

	satisfiedAt := a.getThresholdSatisfiedAt(tracker, minPercentage)
	if satisfiedAt.IsZero() {
		return false
	}

	return satisfiedAt.Equal(*job.CompletedAt)
}

func (a *EnvironmentProgressionAction) getThresholdSatisfiedAt(
	tracker *ReleaseTargetJobTracker,
	minPercentage float32,
) time.Time {
	if minPercentage == 0 {
		return tracker.GetEarliestSuccess()
	}
	return tracker.GetSuccessPercentageSatisfiedAt(minPercentage)
}
