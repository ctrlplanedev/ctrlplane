package gradualrollout

import (
	"context"
	"fmt"
	"hash/fnv"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var fnvHashingFn = func(releaseTarget *oapi.ReleaseTarget, key string) (uint64, error) {
	h := fnv.New64a()
	h.Write([]byte(releaseTarget.Key() + key))
	return h.Sum64(), nil
}

// testTimeGetterFactory allows tests to inject a custom time getter function
// If set, this will be used instead of time.Now() in NewGradualRolloutEvaluator
var testTimeGetterFactory func() time.Time

// SetTestTimeGetterFactory sets a custom time getter factory for testing purposes
// This should only be used in tests
func SetTestTimeGetterFactory(factory func() time.Time) {
	testTimeGetterFactory = factory
}

// ClearTestTimeGetterFactory clears the test time getter factory
// This should be called after tests to restore normal behavior
func ClearTestTimeGetterFactory() {
	testTimeGetterFactory = nil
}

type GradualRolloutEvaluator struct {
	store     *store.Store
	ruleId    string
	rule      *oapi.GradualRolloutRule
	hashingFn func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error)

	// For testing
	timeGetter func() time.Time
}

func NewEvaluator(store *store.Store, rolloutRule *oapi.PolicyRule) evaluator.Evaluator {
	if rolloutRule == nil || rolloutRule.GradualRollout == nil || store == nil {
		return nil
	}

	// Use test time getter if set, otherwise use time.Now()
	timeGetter := func() time.Time {
		return time.Now()
	}
	if testTimeGetterFactory != nil {
		timeGetter = testTimeGetterFactory
	}

	return evaluator.WithMemoization(&GradualRolloutEvaluator{
		store:      store,
		ruleId:     rolloutRule.Id,
		rule:       rolloutRule.GradualRollout,
		hashingFn:  fnvHashingFn,
		timeGetter: timeGetter,
	})
}

// ScopeFields declares that this evaluator cares about Environment, Version, and ReleaseTarget.
func (e *GradualRolloutEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
}

// RuleType returns the rule type identifier for bypass matching.
func (e *GradualRolloutEvaluator) RuleType() string {
	return evaluator.RuleTypeGradualRollout
}

func (e *GradualRolloutEvaluator) RuleId() string {
	return e.ruleId
}

func (e *GradualRolloutEvaluator) Complexity() int {
	return 2
}

func (e *GradualRolloutEvaluator) getStartTimeFromApprovalRule(ctx context.Context, rule *oapi.PolicyRule, scope evaluator.EvaluatorScope, allSkips []*oapi.PolicySkip) *time.Time {
	skips := make([]*oapi.PolicySkip, 0)
	for _, skip := range allSkips {
		if skip.RuleId == rule.Id {
			skips = append(skips, skip)
		}
	}

	// If there are skips for this rule, the approval rule was "satisfied" when:
	// - the latest skip was created, if the version already existed
	// - the version was created, and there was a preexisting skip for this rule and scope
	if len(skips) > 0 {
		sort.Slice(skips, func(i, j int) bool {
			return skips[i].CreatedAt.After(skips[j].CreatedAt)
		})

		latestSkipCreatedAt := skips[0].CreatedAt

		if latestSkipCreatedAt.After(scope.Version.CreatedAt) {
			return &latestSkipCreatedAt
		}

		return &scope.Version.CreatedAt
	}

	approvalEvaluator := approval.NewEvaluator(e.store, rule)
	if approvalEvaluator == nil {
		return nil
	}

	result := approvalEvaluator.Evaluate(ctx, scope)
	if !result.Allowed || result.SatisfiedAt == nil {
		return nil
	}

	return result.SatisfiedAt
}

func (e *GradualRolloutEvaluator) getStartTimeFromEnvironmentProgressionRule(ctx context.Context, rule *oapi.PolicyRule, scope evaluator.EvaluatorScope, allSkips []*oapi.PolicySkip) *time.Time {
	skips := make([]*oapi.PolicySkip, 0)
	for _, skip := range allSkips {
		if skip.RuleId == rule.Id {
			skips = append(skips, skip)
		}
	}

	// If there are skips for this rule, the environment progression rule was "satisfied" when:
	// - the latest skip was created, if the version already existed
	// - the version was created, and there was a preexisting skip for this rule and scope
	if len(skips) > 0 {
		sort.Slice(skips, func(i, j int) bool {
			return skips[i].CreatedAt.After(skips[j].CreatedAt)
		})

		latestSkipCreatedAt := skips[0].CreatedAt

		if latestSkipCreatedAt.After(scope.Version.CreatedAt) {
			return &latestSkipCreatedAt
		}

		return &scope.Version.CreatedAt
	}

	environmentProgressionEvaluator := environmentprogression.NewEvaluator(e.store, rule)
	if environmentProgressionEvaluator == nil {
		return nil
	}

	result := environmentProgressionEvaluator.Evaluate(ctx, scope)
	if !result.Allowed || result.SatisfiedAt == nil {
		return nil
	}

	return result.SatisfiedAt
}

func (e *GradualRolloutEvaluator) getRolloutStartTime(ctx context.Context, environment *oapi.Environment, version *oapi.DeploymentVersion, releaseTarget *oapi.ReleaseTarget) (*time.Time, error) {
	// "start time" is when all conditions pass:
	// - approval rules (if any)
	// - environment progression rules (if any)
	// - deployment window rules:
	//   - allow windows: rollout starts when window opens (if outside)
	//   - deny windows: rollout starts when window ends (if inside)
	policiesForTarget, err := e.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	var approvalSatisfiedAt *time.Time
	var foundApprovalPolicy bool

	var environmentProgressionSatisfiedAt *time.Time
	var foundEnvironmentProgressionPolicy bool

	// Collect all deployment window rules
	var deploymentWindowRules []*oapi.DeploymentWindowRule

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	allSkips := e.store.PolicySkips.GetAllForTarget(version.Id, environment.Id, releaseTarget.ResourceId)

	for _, policy := range policiesForTarget {
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			// Only consider the approval rule if present
			if rule.AnyApproval != nil {
				foundApprovalPolicy = true
				ruleSatisfiedAt := e.getStartTimeFromApprovalRule(ctx, &rule, scope, allSkips)
				if ruleSatisfiedAt != nil {
					if approvalSatisfiedAt == nil || ruleSatisfiedAt.After(*approvalSatisfiedAt) {
						approvalSatisfiedAt = ruleSatisfiedAt
					}
				}
			}

			if rule.EnvironmentProgression != nil {
				foundEnvironmentProgressionPolicy = true
				ruleSatisfiedAt := e.getStartTimeFromEnvironmentProgressionRule(ctx, &rule, scope, allSkips)
				if ruleSatisfiedAt != nil {
					if environmentProgressionSatisfiedAt == nil || ruleSatisfiedAt.After(*environmentProgressionSatisfiedAt) {
						environmentProgressionSatisfiedAt = ruleSatisfiedAt
					}
				}
			}

			// Collect all deployment window rules (both allow and deny)
			if rule.DeploymentWindow != nil {
				deploymentWindowRules = append(deploymentWindowRules, rule.DeploymentWindow)
			}
		}
	}

	// Calculate base start time from approval/progression rules
	var baseStartTime *time.Time

	// If no approval policies exist, use version creation time as base
	if !foundApprovalPolicy && !foundEnvironmentProgressionPolicy {
		baseStartTime = &version.CreatedAt
	} else {
		// If approval policies exist but none are satisfied, return error
		if foundApprovalPolicy && approvalSatisfiedAt == nil {
			return nil, fmt.Errorf("approval condition not yet satisfied for rollout start")
		}

		if foundEnvironmentProgressionPolicy && environmentProgressionSatisfiedAt == nil {
			return nil, fmt.Errorf("environment progression condition not yet satisfied for rollout start")
		}

		if foundApprovalPolicy && foundEnvironmentProgressionPolicy {
			// Use the later of the two times - that's when both conditions are satisfied
			if approvalSatisfiedAt.After(*environmentProgressionSatisfiedAt) {
				baseStartTime = approvalSatisfiedAt
			} else {
				baseStartTime = environmentProgressionSatisfiedAt
			}
		} else if foundApprovalPolicy {
			baseStartTime = approvalSatisfiedAt
		} else {
			baseStartTime = environmentProgressionSatisfiedAt
		}
	}

	// Adjust for deployment windows
	// - Allow windows: if outside, push to when window opens
	// - Deny windows: if inside, push to when window ends
	finalStartTime := baseStartTime
	hasDeployedVersion := true
	if _, _, err := e.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget); err != nil {
		hasDeployedVersion = false
	}
	if !hasDeployedVersion {
		enforcedWindows := make([]*oapi.DeploymentWindowRule, 0, len(deploymentWindowRules))
		for _, windowRule := range deploymentWindowRules {
			if windowRule.EnforceOnFirstDeploy != nil && *windowRule.EnforceOnFirstDeploy {
				enforcedWindows = append(enforcedWindows, windowRule)
			}
		}
		deploymentWindowRules = enforcedWindows
	}
	for _, windowRule := range deploymentWindowRules {
		isAllowWindow := windowRule.AllowWindow == nil || *windowRule.AllowWindow

		if isAllowWindow {
			// Allow window: push to next window start if outside
			nextWindowStart, err := deploymentwindow.GetNextWindowStart(windowRule, *baseStartTime)
			if err != nil {
				continue
			}
			if nextWindowStart != nil && (finalStartTime == nil || nextWindowStart.After(*finalStartTime)) {
				finalStartTime = nextWindowStart
			}
		} else {
			// Deny window: push to window end if inside
			windowEnd, err := deploymentwindow.GetDenyWindowEnd(windowRule, *baseStartTime)
			if err != nil {
				continue
			}
			if windowEnd != nil && (finalStartTime == nil || windowEnd.After(*finalStartTime)) {
				finalStartTime = windowEnd
			}
		}
	}

	return finalStartTime, nil
}

func (e *GradualRolloutEvaluator) getDeploymentOffset(
	rolloutPosition int32,
	timeScaleInterval int32,
	rolloutType oapi.GradualRolloutRuleRolloutType,
	numReleaseTargets int32,
) time.Duration {
	switch rolloutType {
	case oapi.GradualRolloutRuleRolloutTypeLinear:
		return time.Duration(rolloutPosition) * time.Duration(timeScaleInterval) * time.Second

	case oapi.GradualRolloutRuleRolloutTypeLinearNormalized:
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
	resource, ok := e.store.Resources.Get(releaseTarget.ResourceId)
	if !ok {
		return results.
			NewDeniedResult(fmt.Sprintf("Resource not found: %s", releaseTarget.ResourceId)).
			WithDetail("error", fmt.Sprintf("Resource not found: %s", releaseTarget.ResourceId))
	}

	releaseTargets, err := e.getReleaseTargets(environment, version)
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
			WithDetail("target_rollout_time", nil).
			WithDetail("resource", resource)
	}

	rolloutPosition, err := newRolloutPositionBuilder(releaseTargets, e.hashingFn).
		computeHashes(version.Id).
		sortByHash().
		findPosition(releaseTarget).
		build()

	if err != nil {
		return results.
			NewDeniedResult(fmt.Sprintf("Failed to get rollout position: %v", err)).
			WithDetail("release_targets", releaseTargets).
			WithDetail("version", version).
			WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
			WithDetail("target_rollout_position", rolloutPosition).
			WithDetail("resource", resource).
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
			WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339)).
			WithDetail("resource", resource).
			WithNextEvaluationTime(deploymentTime)
	}

	return results.NewAllowedResult("Rollout has progressed to this release target").
		WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
		WithDetail("target_rollout_position", rolloutPosition).
		WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339)).
		WithDetail("resource", resource)
}

func (e *GradualRolloutEvaluator) getReleaseTargets(
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
) ([]*oapi.ReleaseTarget, error) {
	targets, err := e.store.ReleaseTargets.Items()
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
