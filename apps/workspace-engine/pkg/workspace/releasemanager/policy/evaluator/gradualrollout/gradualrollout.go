package gradualrollout

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.EnvironmentAndVersionAndTargetScopedEvaluator = &GradualRolloutEvaluator{}

var fnvHashingFn = func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error) {
	h := fnv.New64a()
	h.Write([]byte(releaseTarget.Key() + versionID))
	return h.Sum64(), nil
}

type GradualRolloutEvaluator struct {
	store      *store.Store
	rule       *oapi.GradualRolloutRule
	hashingFn  func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error)
	timeGetter func() time.Time
}

func NewGradualRolloutEvaluator(store *store.Store, rule *oapi.GradualRolloutRule) *GradualRolloutEvaluator {
	return &GradualRolloutEvaluator{
		store:     store,
		rule:      rule,
		hashingFn: fnvHashingFn,
		timeGetter: func() time.Time {
			return time.Now()
		},
	}
}

func (e *GradualRolloutEvaluator) getRolloutStartTime(ctx context.Context, environment *oapi.Environment, version *oapi.DeploymentVersion, releaseTarget *oapi.ReleaseTarget) (*time.Time, error) {
	policiesForTarget, err := e.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	maxMinApprovals := int32(0)

	for _, policy := range policiesForTarget {
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			if rule.AnyApproval != nil && rule.AnyApproval.MinApprovals > maxMinApprovals {
				maxMinApprovals = rule.AnyApproval.MinApprovals
			}
		}
	}

	if maxMinApprovals == 0 {
		return &version.CreatedAt, nil
	}

	approvalRecords := e.store.UserApprovalRecords.GetApprovalRecords(version.Id, environment.Id)
	if len(approvalRecords) < int(maxMinApprovals) {
		return nil, nil
	}

	firstApprovalRecordSatisfyingMinimumRequired := approvalRecords[maxMinApprovals-1]
	approvalTime, err := time.Parse(time.RFC3339, firstApprovalRecordSatisfyingMinimumRequired.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &approvalTime, nil
}

func (e *GradualRolloutEvaluator) getRolloutPositionForTarget(ctx context.Context, environment *oapi.Environment, version *oapi.DeploymentVersion, releaseTarget *oapi.ReleaseTarget) (int32, error) {
	allReleaseTargets, err := e.store.ReleaseTargets.Items(ctx)
	if err != nil {
		return 0, err
	}

	var relevantTargets []*oapi.ReleaseTarget
	for _, target := range allReleaseTargets {
		if target.EnvironmentId == environment.Id && target.DeploymentId == version.DeploymentId {
			relevantTargets = append(relevantTargets, target)
		}
	}

	// Create a slice with target IDs and their hash values
	type targetWithHash struct {
		target *oapi.ReleaseTarget
		hash   uint64
	}

	targetsWithHashes := make([]targetWithHash, len(relevantTargets))
	for i, target := range relevantTargets {
		hash, err := e.hashingFn(target, version.Id)
		if err != nil {
			return 0, err
		}
		targetsWithHashes[i] = targetWithHash{
			target: target,
			hash:   hash,
		}
	}

	// Sort by hash value
	sort.Slice(targetsWithHashes, func(i, j int) bool {
		return targetsWithHashes[i].hash < targetsWithHashes[j].hash
	})

	// Find position of the current release target
	for i, t := range targetsWithHashes {
		if t.target.Key() == releaseTarget.Key() {
			return int32(i), nil
		}
	}

	return 0, errors.New("release target not found in sorted list")
}

func (e *GradualRolloutEvaluator) getDeploymentOffset(rolloutPosition int32, timeScaleInterval int32) time.Duration {
	return time.Duration(rolloutPosition) * time.Duration(timeScaleInterval) * time.Minute
}

func (e *GradualRolloutEvaluator) Evaluate(ctx context.Context, environment *oapi.Environment, version *oapi.DeploymentVersion, releaseTarget *oapi.ReleaseTarget) (*oapi.RuleEvaluation, error) {
	now := e.timeGetter()
	rolloutStartTime, err := e.getRolloutStartTime(ctx, environment, version, releaseTarget)
	if err != nil {
		return nil, err
	}

	rolloutPosition, err := e.getRolloutPositionForTarget(ctx, environment, version, releaseTarget)
	if err != nil {
		return results.NewDeniedResult("Failed to get rollout position"), err
	}

	if rolloutStartTime == nil {
		return results.
			NewPendingResult(results.ActionTypeWait, "Rollout has not started yet").
			WithDetail("rollout_start_time", nil).
			WithDetail("target_rollout_position", rolloutPosition).
			WithDetail("target_rollout_time", nil), nil
	}

	deploymentOffset := e.getDeploymentOffset(rolloutPosition, e.rule.TimeScaleInterval)
	deploymentTime := rolloutStartTime.Add(deploymentOffset)

	if now.Before(deploymentTime) {
		reason := fmt.Sprintf("Rollout will start at %s for this release target", deploymentTime.Format(time.RFC3339))
		return results.NewPendingResult(results.ActionTypeWait, reason).
			WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
			WithDetail("target_rollout_position", rolloutPosition).
			WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339)), nil
	}

	return results.NewAllowedResult("Rollout has progressed to this release target").
		WithDetail("rollout_start_time", rolloutStartTime.Format(time.RFC3339)).
		WithDetail("target_rollout_position", rolloutPosition).
		WithDetail("target_rollout_time", deploymentTime.Format(time.RFC3339)), nil
}
