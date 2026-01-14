package environmentprogression

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/store"
)

type ReconcileFn func(ctx context.Context, target *oapi.ReleaseTarget) error

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

	progressionDependentTargets, err := a.getProgressionDependentTargets(ctx, progressionDependentPolicies)
	if err != nil {
		return fmt.Errorf("failed to get progression dependent targets: %w", err)
	}

	if len(progressionDependentTargets) == 0 {
		return nil
	}

	return a.reconcileTargets(ctx, progressionDependentTargets)
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

func (a *EnvironmentProgressionAction) getProgressionDependentTargets(ctx context.Context, policies []*oapi.Policy) ([]*oapi.ReleaseTarget, error) {
	targetMap := make(map[string]*oapi.ReleaseTarget)
	for _, policy := range policies {
		policyTargets, err := a.store.ReleaseTargets.GetForPolicy(ctx, policy)
		if err != nil {
			return nil, fmt.Errorf("failed to get release targets for policy %s: %w", policy.Id, err)
		}
		for _, target := range policyTargets {
			targetMap[target.Key()] = target
		}
	}

	targetList := make([]*oapi.ReleaseTarget, 0, len(targetMap))
	for _, target := range targetMap {
		targetList = append(targetList, target)
	}
	return targetList, nil
}

func (a *EnvironmentProgressionAction) reconcileTargets(ctx context.Context, targets []*oapi.ReleaseTarget) error {
	for _, target := range targets {
		if err := a.reconcileFn(ctx, target); err != nil {
			return fmt.Errorf("failed to reconcile target %s: %w", target.Key(), err)
		}
	}
	return nil
}
