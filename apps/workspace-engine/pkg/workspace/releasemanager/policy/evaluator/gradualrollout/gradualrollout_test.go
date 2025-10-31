package gradualrollout

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
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

func createGradualRolloutRule(rolloutType oapi.GradualRolloutRuleRolloutType, timeScaleInterval int32, positionGrowthFactor float32) *oapi.GradualRolloutRule {
	return &oapi.GradualRolloutRule{
		RolloutType:           rolloutType,
		TimeScaleInterval:     timeScaleInterval,
		PositionGrowthFactor:  positionGrowthFactor,
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

	rule := createGradualRolloutRule(oapi.Linear, 60, 1.0)
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

	rule := createGradualRolloutRule(oapi.Linear, 60, 1.0)
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

	rule := createGradualRolloutRule(oapi.LinearNormalized, 60, 1.0)
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

// TestGradualRolloutEvaluator_ExponentialRollout tests that exponential rollout
// creates a front-loaded curve where deployments start fast and slow down
func TestGradualRolloutEvaluator_ExponentialRollout(t *testing.T) {
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
	threeMinutesLater := baseTime.Add(3 * time.Minute)
	timeGetter := func() time.Time {
		return threeMinutesLater
	}

	rule := createGradualRolloutRule(oapi.Exponential, 60, 2.0)
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

	// Position 0: offset = 60 * (1 - e^(-0/2)) = 0 seconds
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: offset = 60 * (1 - e^(-1/2)) ≈ 23.6 seconds
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	expectedOffset1 := 60.0 * (1 - math.Exp(-1.0/2.0))
	deploymentTime1, _ := time.Parse(time.RFC3339, result2.Details["target_rollout_time"].(string))
	actualOffset1 := deploymentTime1.Sub(baseTime).Seconds()
	assert.InDelta(t, expectedOffset1, actualOffset1, 1.0, "position 1 should have exponential offset")

	// Position 2: offset = 60 * (1 - e^(-2/2)) ≈ 37.9 seconds
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	expectedOffset2 := 60.0 * (1 - math.Exp(-2.0/2.0))
	deploymentTime2, _ := time.Parse(time.RFC3339, result3.Details["target_rollout_time"].(string))
	actualOffset2 := deploymentTime2.Sub(baseTime).Seconds()
	assert.InDelta(t, expectedOffset2, actualOffset2, 1.0, "position 2 should have exponential offset")
}

// TestGradualRolloutEvaluator_ExponentialNormalizedRollout tests that exponential-normalized
// rollout creates an exponential curve normalized to timeScaleInterval total duration
func TestGradualRolloutEvaluator_ExponentialNormalizedRollout(t *testing.T) {
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

	rule := createGradualRolloutRule(oapi.ExponentialNormalized, 60, 2.0)
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

	// Position 0: offset = normalized exponential at 0
	scope1 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[0],
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: offset = normalized exponential at 1/3
	scope2 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[1],
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	// Verify it's normalized (should be less than timeScaleInterval)
	deploymentTime2, _ := time.Parse(time.RFC3339, result2.Details["target_rollout_time"].(string))
	offset2 := deploymentTime2.Sub(baseTime)
	assert.Less(t, offset2.Seconds(), float64(60), "normalized exponential should keep total time under timeScaleInterval")

	// Position 2: offset = normalized exponential at 2/3 (should approach but not exceed timeScaleInterval)
	scope3 := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2],
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	deploymentTime3, _ := time.Parse(time.RFC3339, result3.Details["target_rollout_time"].(string))
	offset3 := deploymentTime3.Sub(baseTime)
	assert.LessOrEqual(t, offset3.Seconds(), float64(60), "last target should deploy at or before timeScaleInterval")
}

// TestGradualRolloutEvaluator_RolloutTypeComparison tests that different rollout types
// produce different deployment schedules for the same targets
func TestGradualRolloutEvaluator_RolloutTypeComparison(t *testing.T) {
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
	threeMinutesLater := baseTime.Add(3 * time.Minute)
	timeGetter := func() time.Time {
		return threeMinutesLater
	}

	releaseTargets := []*oapi.ReleaseTarget{
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)),
		st.ReleaseTargets.Get(fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)),
	}

	// Test linear rollout - position 2 should deploy at 120 seconds
	linearRule := createGradualRolloutRule(oapi.Linear, 60, 1.0)
	linearEval := GradualRolloutEvaluator{
		store:      st,
		rule:       linearRule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}
	linearResult := linearEval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2], // Position 2
	})
	linearTime, _ := time.Parse(time.RFC3339, linearResult.Details["target_rollout_time"].(string))
	linearOffset := linearTime.Sub(baseTime)

	// Test exponential rollout - position 2 should deploy faster than linear
	expRule := createGradualRolloutRule(oapi.Exponential, 60, 2.0)
	expEval := GradualRolloutEvaluator{
		store:      st,
		rule:       expRule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}
	expResult := expEval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       version,
		ReleaseTarget: releaseTargets[2], // Position 2
	})
	expTime, _ := time.Parse(time.RFC3339, expResult.Details["target_rollout_time"].(string))
	expOffset := expTime.Sub(baseTime)

	// Exponential should have smaller offset than linear for position 2
	// Linear: 120 seconds, Exponential: ~38 seconds
	assert.Less(t, expOffset.Seconds(), linearOffset.Seconds(),
		"exponential rollout should deploy faster than linear for later positions")
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

	rule := createGradualRolloutRule(oapi.Linear, 0, 1.0)
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

	rule := createGradualRolloutRule(oapi.Linear, 60, 1.0)
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

	rule := createGradualRolloutRule(oapi.Linear, 60, 1.0)
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
