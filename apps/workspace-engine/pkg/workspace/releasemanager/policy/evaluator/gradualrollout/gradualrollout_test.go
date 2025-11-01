package gradualrollout

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateResourceSelector() *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "identifier",
			"operator": "starts-with",
			"value":    "test-resource-",
		},
	})
	return selector
}

func generateMatchAllSelector() *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: "true",
	})
	return selector
}

func generateEnvironment(ctx context.Context, systemID string, store *store.Store) *oapi.Environment {
	environment := &oapi.Environment{
		SystemId:         systemID,
		Id:               uuid.New().String(),
		ResourceSelector: generateResourceSelector(),
	}
	store.Environments.Upsert(ctx, environment)
	return environment
}

func generateDeployment(ctx context.Context, systemID string, store *store.Store) *oapi.Deployment {
	deployment := &oapi.Deployment{
		SystemId:         systemID,
		Id:               uuid.New().String(),
		ResourceSelector: generateResourceSelector(),
	}
	store.Deployments.Upsert(ctx, deployment)
	return deployment
}

func generateResources(ctx context.Context, numResources int, store *store.Store) []*oapi.Resource {
	resources := make([]*oapi.Resource, numResources)
	for i := 0; i < numResources; i++ {
		resource := &oapi.Resource{
			Id:         uuid.New().String(),
			Identifier: fmt.Sprintf("test-resource-%d", i),
			Kind:       "service",
		}
		store.Resources.Upsert(ctx, resource)
		resources[i] = resource
	}
	return resources
}

func generateDeploymentVersion(ctx context.Context, deploymentID string, createdAt time.Time, store *store.Store) *oapi.DeploymentVersion {
	deploymentVersion := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentID,
		Tag:          "v1",
		CreatedAt:    createdAt,
	}
	store.DeploymentVersions.Upsert(ctx, deploymentVersion.Id, deploymentVersion)
	return deploymentVersion
}

// Mock hasher that just returns the number of the resource as its hash
func getHashingFunc(st *store.Store) func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error) {
	return func(releaseTarget *oapi.ReleaseTarget, versionID string) (uint64, error) {
		resource, ok := st.Resources.Get(releaseTarget.ResourceId)
		if !ok {
			return 0, fmt.Errorf("resource not found: %s", releaseTarget.ResourceId)
		}
		resourceNumString := resource.Identifier[len("test-resource-"):]
		resourceNum, err := strconv.Atoi(resourceNumString)
		if err != nil {
			return 0, fmt.Errorf("failed to convert resource number to int: %w", err)
		}
		return uint64(resourceNum), nil
	}
}

func createGradualRolloutRule(rolloutType oapi.GradualRolloutRuleRolloutType, timeScaleInterval int32) *oapi.GradualRolloutRule {
	return &oapi.GradualRolloutRule{
		RolloutType:           rolloutType,
		TimeScaleInterval:     timeScaleInterval,
	}
}

// TestGradualRolloutEvaluator_LinearRollout tests that linear rollout uses fixed intervals
// Position 0: deploys immediately (0 seconds)
// Position 1: deploys after timeScaleInterval seconds (60 seconds)
// Position 2: deploys after 2 * timeScaleInterval seconds (120 seconds)
func TestGradualRolloutEvaluator_LinearRollout(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	threeMinutesLater := baseTime.Add(3 * time.Minute) // Enough time for all deployments
	timeGetter := func() time.Time {
		return threeMinutesLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// Position 0: deploys immediately (offset = 0 * 60 = 0 seconds)
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should deploy immediately")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds (offset = 1 * 60 = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed, "position 1 should deploy after 60 seconds")
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds (offset = 2 * 60 = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed, "position 2 should deploy after 120 seconds")
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_LinearRollout_Pending tests that linear rollout returns pending
// when the current time hasn't reached the deployment time yet
func TestGradualRolloutEvaluator_LinearRollout_Pending(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	thirtySecondsLater := baseTime.Add(30 * time.Second) // Not enough time for position 2
	timeGetter := func() time.Time {
		return thirtySecondsLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// Position 0: deploys immediately - should be allowed
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)

	// Position 1: deploys after 60 seconds, but we're only at 30 seconds - should be pending
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.False(t, result2.Allowed)
	assert.True(t, result2.ActionRequired)
	assert.NotNil(t, result2.ActionType)
	assert.Equal(t, oapi.Wait, *result2.ActionType)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])

	// Position 2: deploys after 120 seconds - should be pending
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.False(t, result3.Allowed)
	assert.True(t, result3.ActionRequired)
	assert.NotNil(t, result3.ActionType)
	assert.Equal(t, oapi.Wait, *result3.ActionType)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
}

// TestGradualRolloutEvaluator_LinearNormalizedRollout tests that linear-normalized rollout
// spaces deployments evenly across all targets, ensuring total rollout time = timeScaleInterval
func TestGradualRolloutEvaluator_LinearNormalizedRollout(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoMinutesLater := baseTime.Add(2 * time.Minute)
	timeGetter := func() time.Time {
		return twoMinutesLater
	}

	rule := createGradualRolloutRule(oapi.LinearNormalized, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// Position 0: offset = (0/3) * 60 = 0 seconds
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: offset = (1/3) * 60 = 20 seconds
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(20*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: offset = (2/3) * 60 = 40 seconds
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(40*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}


// TestGradualRolloutEvaluator_ZeroTimeScaleIntervalStartsImmediately tests that zero timeScaleInterval
// causes all targets to deploy immediately regardless of rollout type
func TestGradualRolloutEvaluator_ZeroTimeScaleIntervalStartsImmediately(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	oneHourLater := baseTime.Add(1 * time.Hour)
	timeGetter := func() time.Time {
		return oneHourLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 0)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// All positions should deploy immediately when timeScaleInterval is 0
	for i, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment:   environment,
			Version:       version,
			ReleaseTarget: releaseTarget,
		}
		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "position %d should deploy immediately", i)
		assert.Equal(t, int32(i), result.Details["target_rollout_position"])
		assert.Equal(t, baseTime.Format(time.RFC3339), result.Details["target_rollout_time"])
	}
}

// TestGradualRolloutEvaluator_UnsatisfiedApprovalRequirement tests that rollout doesn't start
// until approval requirements are satisfied
func TestGradualRolloutEvaluator_UnsatisfiedApprovalRequirement(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, approvalPolicy)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Format(time.RFC3339),
	})

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// All targets should be pending since approval requirement isn't met
	for _, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment:   environment,
			Version:       version,
			ReleaseTarget: releaseTarget,
		}
		result := eval.Evaluate(ctx, scope)
		assert.False(t, result.Allowed, "target should be pending")
		assert.True(t, result.ActionRequired, "target should require action")
		assert.NotNil(t, result.ActionType, "target should have action type")
		assert.Equal(t, oapi.Wait, *result.ActionType)
		assert.Equal(t, "Rollout has not started yet", result.Message)
		assert.Nil(t, result.Details["rollout_start_time"])
		assert.Nil(t, result.Details["target_rollout_time"])
		// Position is not calculated when rollout hasn't started
	}
}

// TestGradualRolloutEvaluator_SatisfiedApprovalRequirement tests that rollout starts
// when approval requirements are satisfied
func TestGradualRolloutEvaluator_SatisfiedApprovalRequirement(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	oneHourLater := baseTime.Add(1 * time.Hour)
	twoHoursLater := baseTime.Add(2 * time.Hour)

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, approvalPolicy)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Format(time.RFC3339),
	})

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     oneHourLater.Format(time.RFC3339),
	})

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     twoHoursLater.Format(time.RFC3339),
	})

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// Position 0: deploys immediately after approval (offset = 0)
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds from approval (offset = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds from approval (offset = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result3.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SuccessPercentage tests that rollout starts
// when environment progression with only success percentage is satisfied
func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SuccessPercentage(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	envProgPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, envProgPolicy)

	// Create releases and successful jobs in staging to satisfy 100% success rate
	stagingReleaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, stagingEnv.Id, deployment.Id)),
	}

	successTime := baseTime.Add(1 * time.Hour) // Success happens 1 hour after version creation
	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)

		completedAt := successTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.Successful,
			CreatedAt:   successTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, prodEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, prodEnv.Id, deployment.Id)),
	}

	// Position 0: deploys immediately after environment progression is satisfied
	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be when success percentage was satisfied (last job completion)
	expectedStartTime := successTime.Add(2 * time.Minute) // Last job completed at this time
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SoakTime tests that rollout starts
// when environment progression with only soak time is satisfied
func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SoakTime(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 1, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	soakMinutes := int32(30) // 30 minutes soak time
	envProgPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSockTimeMinutes:      &soakMinutes,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, envProgPolicy)

	// Create release and successful job in staging
	stagingRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id))
	release := &oapi.Release{
		ReleaseTarget: *stagingRT,
		Version:       *version,
	}
	st.Releases.Upsert(ctx, release)

	// Job completes 1 hour after version creation
	jobCompletedAt := baseTime.Add(1 * time.Hour)
	job := &oapi.Job{
		Id:          "job-staging-1",
		ReleaseId:   release.ID(),
		Status:      oapi.Successful,
		CreatedAt:   baseTime,
		CompletedAt: &jobCompletedAt,
		UpdatedAt:   jobCompletedAt,
	}
	st.Jobs.Upsert(ctx, job)

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	// Position 0: deploys after soak time is satisfied
	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be when soak time was satisfied: jobCompletedAt + soakMinutes
	expectedStartTime := jobCompletedAt.Add(time.Duration(soakMinutes) * time.Minute)
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_EnvironmentProgressionOnly_BothSuccessPercentageAndSoakTime tests that rollout starts
// when environment progression with both success percentage and soak time is satisfied
func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_BothSuccessPercentageAndSoakTime(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	soakMinutes := int32(30)
	envProgPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
					MinimumSockTimeMinutes:       &soakMinutes,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, envProgPolicy)

	// Create releases and successful jobs in staging
	stagingReleaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, stagingEnv.Id, deployment.Id)),
	}

	successTime := baseTime.Add(1 * time.Hour)
	lastJobCompletedAt := successTime.Add(2 * time.Minute) // Last job completes at this time
	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)

		completedAt := successTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.Successful,
			CreatedAt:   successTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	// Position 0: deploys after both conditions are satisfied (soak time is later)
	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be when soak time was satisfied: lastJobCompletedAt + soakMinutes
	expectedStartTime := lastJobCompletedAt.Add(time.Duration(soakMinutes) * time.Minute)
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_EnvironmentProgressionOnly_Unsatisfied tests that rollout doesn't start
// when environment progression requirements are not satisfied
func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_Unsatisfied(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	envProgPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, envProgPolicy)

	// Don't create any jobs in staging - condition won't be satisfied

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.False(t, result1.Allowed)
	assert.True(t, result1.ActionRequired)
	assert.NotNil(t, result1.ActionType)
	assert.Equal(t, oapi.Wait, *result1.ActionType)
	assert.Equal(t, "Rollout has not started yet", result1.Message)
	assert.Nil(t, result1.Details["rollout_start_time"])
	assert.Nil(t, result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_BothPolicies_BothSatisfied tests that rollout starts
// when both approval and environment progression are satisfied, using the later of the two
func TestGradualRolloutEvaluator_BothPolicies_BothSatisfied(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	policy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, policy)

	// Approval happens at 30 minutes
	approvalTime := baseTime.Add(30 * time.Minute)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	// Environment progression happens at 1 hour (later than approval)
	envProgTime := baseTime.Add(1 * time.Hour)
	stagingReleaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, stagingEnv.Id, deployment.Id)),
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.Successful,
			CreatedAt:   envProgTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	// Position 0: deploys after the later condition (environment progression)
	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be when environment progression was satisfied (later)
	expectedStartTime := envProgTime.Add(2 * time.Minute) // Last job completed
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, expectedStartTime.Format(time.RFC3339), result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_BothPolicies_ApprovalLater tests that rollout starts
// when both policies are satisfied but approval happens later
func TestGradualRolloutEvaluator_BothPolicies_ApprovalLater(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	policy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, policy)

	// Environment progression happens at 30 minutes (earlier)
	envProgTime := baseTime.Add(30 * time.Minute)
	stagingReleaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, stagingEnv.Id, deployment.Id)),
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.Successful,
			CreatedAt:   envProgTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Approval happens at 1 hour (later than environment progression)
	approvalTime := baseTime.Add(1 * time.Hour)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	// Position 0: deploys after the later condition (approval)
	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be when approval was satisfied (later)
	assert.Equal(t, approvalTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, approvalTime.Format(time.RFC3339), result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_BothPolicies_ApprovalUnsatisfied tests that rollout doesn't start
// when approval is not satisfied even if environment progression is satisfied
func TestGradualRolloutEvaluator_BothPolicies_ApprovalUnsatisfied(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	policy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, policy)

	// Environment progression is satisfied
	envProgTime := baseTime.Add(30 * time.Minute)
	stagingReleaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, stagingEnv.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, stagingEnv.Id, deployment.Id)),
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.Successful,
			CreatedAt:   envProgTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Approval is NOT satisfied (only 1 approval, need 2)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Format(time.RFC3339),
	})

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.False(t, result1.Allowed)
	assert.True(t, result1.ActionRequired)
	assert.NotNil(t, result1.ActionType)
	assert.Equal(t, oapi.Wait, *result1.ActionType)
	assert.Equal(t, "Rollout has not started yet", result1.Message)
	assert.Nil(t, result1.Details["rollout_start_time"])
	assert.Nil(t, result1.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_BothPolicies_EnvProgUnsatisfied tests that rollout doesn't start
// when environment progression is not satisfied even if approval is satisfied
func TestGradualRolloutEvaluator_BothPolicies_EnvProgUnsatisfied(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.Linear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create selector for staging environment
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(100.0)
	policy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, policy)

	// Approval is satisfied
	approvalTime := baseTime.Add(30 * time.Minute)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: prodEnv.Id,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	// Environment progression is NOT satisfied (no jobs in staging)

	prodRT := st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, prodEnv.Id, deployment.Id))

	scope1 := evaluator.EvaluatorScope{
		Environment:   prodEnv,
		Version:       version,
		ReleaseTarget: prodRT,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.False(t, result1.Allowed)
	assert.True(t, result1.ActionRequired)
	assert.NotNil(t, result1.ActionType)
	assert.Equal(t, oapi.Wait, *result1.ActionType)
	assert.Equal(t, "Rollout has not started yet", result1.Message)
	assert.Nil(t, result1.Details["rollout_start_time"])
	assert.Nil(t, result1.Details["target_rollout_time"])
}
