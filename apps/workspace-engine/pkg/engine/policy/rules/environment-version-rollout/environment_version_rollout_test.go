package environmentversionrollout

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"

	"gotest.tools/assert"
)

type EnvironmentVersionRolloutTest struct {
	name             string
	rule             EnvironmentVersionRolloutRule
	expectedDecision rules.PolicyDecision
	expectedError    error
	expectedMessage  string
}

func TestEnvironmentVersionRollout(t *testing.T) {
	releaseTarget := rt.ReleaseTarget{
		Resource: resource.Resource{
			ID: "resource-1",
		},
		Environment: environment.Environment{
			ID: "environment-1",
		},
		Deployment: deployment.Deployment{
			ID: "deployment-1",
		},
	}
	version := deployment.DeploymentVersion{
		ID: "version-1",
	}

	rejectsIfRolloutNotStarted := EnvironmentVersionRolloutTest{
		name: "rejects if rollout not started",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return nil, nil
			},
		},
		expectedDecision: rules.PolicyDecisionDeny,
		expectedError:    nil,
		expectedMessage:  "Rollout not yet started.",
	}

	errorsIfRolloutStartTimeFunctionReturnsError := EnvironmentVersionRolloutTest{
		name: "errors if rollout start time function returns error",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return nil, errors.New("rollout start time function error")
			},
		},
		expectedDecision: rules.PolicyDecisionDeny,
		expectedError:    errors.New("rollout start time function error"),
		expectedMessage:  "Error getting rollout start time: rollout start time function error",
	}

	rejectsIfReleaseTargetPositionFunctionReturnsError := EnvironmentVersionRolloutTest{
		name: "rejects if release target position function returns error",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return &time.Time{}, nil
			},
			releaseTargetPositionFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
				return 0, errors.New("release target position function error")
			},
		},
		expectedDecision: rules.PolicyDecisionDeny,
		expectedError:    errors.New("release target position function error"),
		expectedMessage:  "Error getting release target position: release target position function error",
	}

	rejectsIfOffsetFunctionGetterReturnsError := EnvironmentVersionRolloutTest{
		name: "rejects if offset function getter returns error",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return &time.Time{}, nil
			},
			releaseTargetPositionFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
				return 0, nil
			},
			offsetFunctionGetter: func(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
				return nil, errors.New("offset function getter error")
			},
		},
		expectedDecision: rules.PolicyDecisionDeny,
		expectedError:    errors.New("offset function getter error"),
		expectedMessage:  "Error getting offset function: offset function getter error",
	}

	now := time.Now().UTC()

	releaseTargetPosition := rand.Intn(20) + 1 // random number between 1 and 20
	rejectsIfReleaseTargetRolloutTimeIsInTheFuture := EnvironmentVersionRolloutTest{
		name: "rejects if release target rollout time is in the future",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return &now, nil
			},
			releaseTargetPositionFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
				return releaseTargetPosition, nil
			},
			offsetFunctionGetter: func(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
				return func(ctx context.Context, position int) time.Duration {
					return time.Duration(position) * time.Hour
				}, nil
			},
		},
		expectedDecision: rules.PolicyDecisionDeny,
		expectedError:    nil,
		expectedMessage:  fmt.Sprintf("Release target %s will be rolled out at %s.", releaseTarget.GetID(), now.Add(time.Duration(releaseTargetPosition)*time.Hour).Format(time.RFC3339)),
	}

	thirtyHoursBeforeNow := now.Add(-time.Hour * 30)
	allowsIfReleaseTargetRolloutTimeIsInThePast := EnvironmentVersionRolloutTest{
		name: "allows if release target rollout time is in the past",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return &thirtyHoursBeforeNow, nil
			},
			releaseTargetPositionFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
				return releaseTargetPosition, nil
			},
			offsetFunctionGetter: func(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
				return func(ctx context.Context, position int) time.Duration {
					return time.Duration(position) * time.Hour
				}, nil
			},
		},
		expectedDecision: rules.PolicyDecisionAllow,
		expectedError:    nil,
		expectedMessage:  "",
	}

	allowsIfReleaseTargetRolloutTimeIsEqualToNow := EnvironmentVersionRolloutTest{
		name: "allows if release target rollout time is equal to now",
		rule: EnvironmentVersionRolloutRule{
			rolloutStartTimeFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
				return &now, nil
			},
			releaseTargetPositionFunction: func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
				return 0, nil
			},
			offsetFunctionGetter: func(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
				return func(ctx context.Context, position int) time.Duration {
					return time.Duration(position) * time.Hour
				}, nil
			},
		},
		expectedDecision: rules.PolicyDecisionAllow,
		expectedError:    nil,
		expectedMessage:  "",
	}

	tests := []EnvironmentVersionRolloutTest{
		rejectsIfRolloutNotStarted,
		errorsIfRolloutStartTimeFunctionReturnsError,
		rejectsIfReleaseTargetPositionFunctionReturnsError,
		rejectsIfOffsetFunctionGetterReturnsError,
		rejectsIfReleaseTargetRolloutTimeIsInTheFuture,
		allowsIfReleaseTargetRolloutTimeIsInThePast,
		allowsIfReleaseTargetRolloutTimeIsEqualToNow,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {

			ctx := context.Background()
			decision, err := test.rule.Evaluate(ctx, releaseTarget, version)
			assert.Equal(t, test.rule.GetType(), rules.RuleTypeEnvironmentVersionRollout)
			assert.Equal(t, decision.Decision, test.expectedDecision)
			assert.Equal(t, decision.Message, test.expectedMessage)

			if test.expectedError != nil {
				assert.ErrorContains(t, err, test.expectedError.Error())
				return
			}

			assert.NilError(t, err)
		})
	}
}
