package environmentversionrollout

import (
	"context"
	"fmt"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/deployment"
	modelrules "workspace-engine/pkg/model/policy/rules"
)

var _ rules.Rule = (*EnvironmentVersionRolloutRule)(nil)

// EnvironmentVersionRolloutRule evaluates whether a release target should be deployed to given a gradual rollout.
//
// The rule uses three functions:
//   - rolloutStartTimeFunction: returns the start time of the rollout for a given release target and version
//   - releaseTargetPositionFunction: returns the position of the release target in the rollout for a given release target and version
//   - offsetFunctionGetter: returns the offset function for a given rollout type
//
// When initializing this rule, the initializer will own the functions and will be responsible for providing the correct values for the functions.
// The rule will just determine, based on the parameters provided, whether the release target should be deployed to.
type EnvironmentVersionRolloutRule struct {
	rules.BaseRule

	modelrules.EnvironmentVersionRolloutRule

	// The function that will be used to determine the rollout start time.
	rolloutStartTimeFunction func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error)

	// The function that will be used to determine the release target position.
	releaseTargetPositionFunction func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error)

	// A getter for the offset function
	offsetFunctionGetter OffsetFunctionGetter

	// A pointer to the workspace's release targets repo
	releaseTargetsRepo *rt.ReleaseTargetRepository
}

func (r *EnvironmentVersionRolloutRule) GetType() rules.RuleType {
	return rules.RuleTypeEnvironmentVersionRollout
}

func (r *EnvironmentVersionRolloutRule) Evaluate(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*rules.RuleEvaluationResult, error) {
	now := time.Now().UTC()

	rolloutStartTime, err := r.rolloutStartTimeFunction(ctx, target, version)
	if err != nil {
		return &rules.RuleEvaluationResult{
			RuleID:      r.GetID(),
			Decision:    rules.PolicyDecisionDeny,
			Message:     fmt.Sprintf("Error getting rollout start time: %s", err.Error()),
			EvaluatedAt: now,
		}, err
	}

	if rolloutStartTime == nil {
		return &rules.RuleEvaluationResult{
			RuleID:      r.GetID(),
			Decision:    rules.PolicyDecisionDeny,
			Message:     "Rollout not yet started.",
			EvaluatedAt: now,
		}, nil
	}

	position, err := r.releaseTargetPositionFunction(ctx, target, version)
	if err != nil {
		return &rules.RuleEvaluationResult{
			RuleID:      r.GetID(),
			Decision:    rules.PolicyDecisionDeny,
			Message:     fmt.Sprintf("Error getting release target position: %s", err.Error()),
			EvaluatedAt: now,
		}, err
	}

	numReleaseTargets := len(r.releaseTargetsRepo.GetAllForDeploymentAndEnvironment(ctx, target.Deployment.GetID(), target.Environment.GetID()))

	offsetFunction, err := r.offsetFunctionGetter(r.PositionGrowthFactor, r.TimeScaleInterval, numReleaseTargets)
	if err != nil {
		return &rules.RuleEvaluationResult{
			RuleID:      r.GetID(),
			Decision:    rules.PolicyDecisionDeny,
			Message:     fmt.Sprintf("Error getting offset function: %s", err.Error()),
			EvaluatedAt: now,
		}, err
	}
	offset := offsetFunction(ctx, position)
	releaseTargetRolloutTime := rolloutStartTime.Add(offset)

	if now.Before(releaseTargetRolloutTime) {
		return &rules.RuleEvaluationResult{
			RuleID:      r.GetID(),
			Decision:    rules.PolicyDecisionDeny,
			Message:     fmt.Sprintf("Release target %s will be rolled out at %s.", target.GetID(), releaseTargetRolloutTime.Format(time.RFC3339)),
			EvaluatedAt: now,
		}, nil
	}

	return &rules.RuleEvaluationResult{
		RuleID:      r.GetID(),
		Decision:    rules.PolicyDecisionAllow,
		EvaluatedAt: now,
	}, nil
}
