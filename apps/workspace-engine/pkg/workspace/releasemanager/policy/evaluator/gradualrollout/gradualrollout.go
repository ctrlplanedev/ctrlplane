package gradualrollout

import (
	"context"
	"fmt"
	"hash/fnv"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &GradualRolloutEvaluator{}

var fnvHashingFn = func(releaseTarget *oapi.ReleaseTarget, key string) (uint64, error) {
	h := fnv.New64a()
	h.Write([]byte(releaseTarget.Key() + key))
	return h.Sum64(), nil
}

type GradualRolloutEvaluator struct {
	store     *store.Store
	rule      *oapi.GradualRolloutRule
	hashingFn func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error)

	// For testing
	timeGetter func() time.Time
}

func NewGradualRolloutEvaluator(store *store.Store, rule *oapi.PolicyRule) evaluator.Evaluator {
	if rule.GradualRollout == nil {
		return nil
	}
	return evaluator.WithMemoization(&GradualRolloutEvaluator{
		store:     store,
		rule:      rule.GradualRollout,
		hashingFn: fnvHashingFn,
		timeGetter: func() time.Time {
			return time.Now()
		},
	})
}

// ScopeFields declares that this evaluator cares about Environment, Version, and ReleaseTarget.
func (e *GradualRolloutEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
}

func (e *GradualRolloutEvaluator) getRolloutStartTime(ctx context.Context, environment *oapi.Environment, version *oapi.DeploymentVersion, releaseTarget *oapi.ReleaseTarget) (*time.Time, error) {
	// "start time" is when the approval condition passes
	policiesForTarget, err := e.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	var approvalSatisfiedAt *time.Time
	var foundApprovalPolicy bool

	var environmentProgressionSatisfiedAt *time.Time
	var foundEnvironmentProgressionPolicy bool

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	for _, policy := range policiesForTarget {
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			// Only consider the approval rule if present
			if rule.AnyApproval != nil {
				foundApprovalPolicy = true
				approvalEvaluator := approval.NewAnyApprovalEvaluator(e.store, rule.AnyApproval)
				if approvalEvaluator == nil {
					continue
				}

				result := approvalEvaluator.Evaluate(ctx, scope)
				if result.Allowed && result.SatisfiedAt != nil {
					// pick the latest SatisfiedAt if multiple approvals exist
					if approvalSatisfiedAt == nil || result.SatisfiedAt.After(*approvalSatisfiedAt) {
						approvalSatisfiedAt = result.SatisfiedAt
					}
				}
			}

			if rule.EnvironmentProgression != nil {
				foundEnvironmentProgressionPolicy = true
				environmentProgressionEvaluator := environmentprogression.NewEnvironmentProgressionEvaluator(e.store, rule.EnvironmentProgression)
				if environmentProgressionEvaluator == nil {
					continue
				}

				result := environmentProgressionEvaluator.Evaluate(ctx, scope)
				if result.Allowed && result.SatisfiedAt != nil {
					// pick the latest SatisfiedAt if multiple environment progression policies exist
					if environmentProgressionSatisfiedAt == nil || result.SatisfiedAt.After(*environmentProgressionSatisfiedAt) {
						environmentProgressionSatisfiedAt = result.SatisfiedAt
					}
				}
			}
		}
	}

	// If no approval policies exist, use version creation time as rollout start
	if !foundApprovalPolicy && !foundEnvironmentProgressionPolicy {
		return &version.CreatedAt, nil
	}

	// If approval policies exist but none are satisfied, return error
	if foundApprovalPolicy && approvalSatisfiedAt == nil {
		return nil, fmt.Errorf("approval condition not yet satisfied for rollout start")
	}

	if foundEnvironmentProgressionPolicy && environmentProgressionSatisfiedAt == nil {
		return nil, fmt.Errorf("environment progression condition not yet satisfied for rollout start")
	}

	if foundApprovalPolicy && foundEnvironmentProgressionPolicy {
		// Return the later of the two times - that's when both conditions are satisfied
		if approvalSatisfiedAt.After(*environmentProgressionSatisfiedAt) {
			return approvalSatisfiedAt, nil
		}
		return environmentProgressionSatisfiedAt, nil
	}

	// Only one policy type was found - return whichever one is satisfied
	if foundApprovalPolicy {
		return approvalSatisfiedAt, nil
	}

	return environmentProgressionSatisfiedAt, nil
}

func (e *GradualRolloutEvaluator) getDeploymentOffset(
	rolloutPosition int32,
	timeScaleInterval int32,
	rolloutType oapi.GradualRolloutRuleRolloutType,
	numReleaseTargets int32,
) time.Duration {
	switch rolloutType {
	case oapi.Linear:
		return time.Duration(rolloutPosition) * time.Duration(timeScaleInterval) * time.Second

	case oapi.LinearNormalized:
		return time.Duration(float64(rolloutPosition)/float64(numReleaseTargets)*float64(timeScaleInterval)) * time.Second

	default:
		// Default to linear for backward compatibility
		return time.Duration(rolloutPosition) * time.Duration(timeScaleInterval) * time.Second
	}
}

// Evaluate checks if a gradual rollout has progressed enough to allow deployment to this release target.
// The memoization wrapper ensures Environment, Version, and ReleaseTarget are present.
func (e *GradualRolloutEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	environment := scope.Environment
	version := scope.Version
	releaseTarget := scope.ReleaseTarget

	for _, release := range e.store.Releases.Items() {
		if release.Version.Id == version.Id && release.ReleaseTarget.Key() == releaseTarget.Key() {
			return results.NewAllowedResult("Version has already been deployed to this release target.").
				WithDetail("release_id", release.ID()).
				WithDetail("version_id", version.Id).
				WithDetail("environment_id", environment.Id).
				WithDetail("release_target", releaseTarget.Key())
		}
	}

	releaseTargets, err := e.getReleaseTargets(ctx, environment, version)
	if err != nil {
		return results.
			NewDeniedResult(fmt.Sprintf("Failed to get release targets: %v", err)).
			WithDetail("error", err.Error())
	}

	now := e.timeGetter()
	rolloutStartTime, err := e.getRolloutStartTime(ctx, environment, version, releaseTarget)
	if err != nil || rolloutStartTime == nil {
		return results.
			NewPendingResult(results.ActionTypeWait, "Rollout has not started yet").
			WithDetail("rollout_start_time", nil).
			WithDetail("target_rollout_time", nil)
	}

	rolloutPosition, err := newRolloutPositionBuilder(releaseTargets, e.hashingFn).
		computeHashes(version.Id).
		sortByHash().
		findPosition(releaseTarget).
		build()

	if err != nil {
		return results.
			NewDeniedResult(fmt.Sprintf("Failed to get rollout position: %v", err)).
			WithDetail("error", err.Error())
	}

	deploymentOffset := e.getDeploymentOffset(
		rolloutPosition,
		e.rule.TimeScaleInterval,
		e.rule.RolloutType,
		int32(len(releaseTargets)),
	)
	deploymentTime := rolloutStartTime.Add(deploymentOffset)

	if now.Before(deploymentTime) {
		reason := fmt.Sprintf("Rollout will start at %s for this release target", deploymentTime.Format(time.RFC3339))
		return results.NewPendingResult(results.ActionTypeWait, reason).
			WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
			WithDetail("target_rollout_position", rolloutPosition).
			WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339))
	}

	return results.NewAllowedResult("Rollout has progressed to this release target").
		WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
		WithDetail("target_rollout_position", rolloutPosition).
		WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339))
}

func (e *GradualRolloutEvaluator) getReleaseTargets(
	ctx context.Context,
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
) ([]*oapi.ReleaseTarget, error) {
	targets, err := e.store.ReleaseTargets.Items(ctx)
	if err != nil {
		return nil, err
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0, len(targets))
	for _, releaseTarget := range targets {
		if releaseTarget.EnvironmentId == environment.Id && releaseTarget.DeploymentId == version.DeploymentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}

	return releaseTargets, nil
}
