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

func generateEnvironment(ctx context.Context, systemID string, store *store.Store) *oapi.Environment {
	environment := &oapi.Environment{
		Id:               uuid.New().String(),
		ResourceSelector: generateResourceSelector(),
	}
	_ = store.Environments.Upsert(ctx, environment)
	_ = store.SystemEnvironments.Link(systemID, environment.Id)
	return environment
}

func generateDeployment(ctx context.Context, systemID string, store *store.Store) *oapi.Deployment {
	deployment := &oapi.Deployment{
		Id:               uuid.New().String(),
		ResourceSelector: generateResourceSelector(),
	}
	_ = store.Deployments.Upsert(ctx, deployment)
	_ = store.SystemDeployments.Link(systemID, deployment.Id)
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
		_, _ = store.Resources.Upsert(ctx, resource)
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

func seedSuccessfulRelease(ctx context.Context, store *store.Store, releaseTarget *oapi.ReleaseTarget) *oapi.Release {
	versionCreatedAt := time.Now().Add(-24 * time.Hour)
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: releaseTarget.DeploymentId,
		Tag:          "seed",
		CreatedAt:    versionCreatedAt,
	}
	store.DeploymentVersions.Upsert(ctx, version.Id, version)

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		CreatedAt:     versionCreatedAt.Add(30 * time.Minute).Format(time.RFC3339),
	}
	_ = store.Releases.Upsert(ctx, release)

	completedAt := time.Now().Add(-23 * time.Hour)
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &completedAt,
		CreatedAt:   completedAt,
	}
	store.Jobs.Upsert(ctx, job)

	return release
}

func seedSuccessfulReleaseTargets(ctx context.Context, store *store.Store, releaseTargets []*oapi.ReleaseTarget) {
	for _, releaseTarget := range releaseTargets {
		seedSuccessfulRelease(ctx, store, releaseTarget)
	}
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

func createGradualRolloutRule(rolloutType oapi.GradualRolloutRuleRolloutType, timeScaleInterval int32) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id: "gradualRollout",
		GradualRollout: &oapi.GradualRolloutRule{
			RolloutType:       rolloutType,
			TimeScaleInterval: timeScaleInterval,
		},
	}
}

// TestGradualRolloutEvaluator_LinearRollout tests that linear rollout uses fixed intervals
// Position 0: deploys immediately (0 seconds)
// Position 1: deploys after timeScaleInterval seconds (60 seconds)
// Position 2: deploys after 2 * timeScaleInterval seconds (120 seconds)
func TestGradualRolloutEvaluator_LinearRollout(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	hashingFn := getHashingFunc(st)
	threeMinutesLater := baseTime.Add(3 * time.Minute) // Enough time for all deployments
	timeGetter := func() time.Time {
		return threeMinutesLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Position 0: deploys immediately (offset = 0 * 60 = 0 seconds)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should deploy immediately")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds (offset = 1 * 60 = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed, "position 1 should deploy after 60 seconds")
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds (offset = 2 * 60 = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	hashingFn := getHashingFunc(st)
	thirtySecondsLater := baseTime.Add(30 * time.Second) // Not enough time for position 2
	timeGetter := func() time.Time {
		return thirtySecondsLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Position 0: deploys immediately - should be allowed
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)

	// Position 1: deploys after 60 seconds, but we're only at 30 seconds - should be pending
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.False(t, result2.Allowed)
	assert.True(t, result2.ActionRequired)
	assert.NotNil(t, result2.ActionType)
	assert.Equal(t, oapi.Wait, *result2.ActionType)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])

	// Position 2: deploys after 120 seconds - should be pending
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	hashingFn := getHashingFunc(st)
	twoMinutesLater := baseTime.Add(2 * time.Minute)
	timeGetter := func() time.Time {
		return twoMinutesLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinearNormalized, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Position 0: offset = (0/3) * 60 = 0 seconds
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: offset = (1/3) * 60 = 20 seconds
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(20*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: offset = (2/3) * 60 = 40 seconds
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	hashingFn := getHashingFunc(st)
	oneHourLater := baseTime.Add(1 * time.Hour)
	timeGetter := func() time.Time {
		return oneHourLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 0)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// All positions should deploy immediately when timeScaleInterval is 0
	for i, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
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
	st := store.New("test-workspace", sc)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
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

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// All targets should be pending since approval requirement isn't met
	for _, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
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
	st := store.New("test-workspace", sc)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
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

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 0: deploys immediately after approval (offset = 0)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds from approval (offset = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds from approval (offset = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result3.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_IfApprovalPolicySkipped_RolloutStartsImmediately tests that rollout starts
// immediately if the approval policy is skipped
func TestGradualRolloutEvaluator_IfApprovalPolicySkipped_RolloutStartsImmediately(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	twoHoursLater := baseTime.Add(2 * time.Hour)

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "approval-rule",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, approvalPolicy)
	policySkip := &oapi.PolicySkip{
		RuleId:        approvalPolicy.Rules[0].Id,
		VersionId:     version.Id,
		EnvironmentId: &environment.Id,
		CreatedBy:     "test-user",
		CreatedAt:     baseTime,
	}
	st.PolicySkips.Upsert(ctx, policySkip)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 0: deploys immediately after approval (offset = 0)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds from approval (offset = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds from approval (offset = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result3.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_IfEnvironmentProgressionPolicySkipped_RolloutStartsImmediately tests that rollout starts
// immediately if the environment progression policy is skipped
func TestGradualRolloutEvaluator_IfEnvironmentProgressionPolicySkipped_RolloutStartsImmediately(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	twoHoursLater := baseTime.Add(2 * time.Hour)

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
	environmentProgressionPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "environment-progression-rule",
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSuccessPercentage:     &minSuccessPercentage,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, environmentProgressionPolicy)
	policySkip := &oapi.PolicySkip{
		RuleId:        environmentProgressionPolicy.Rules[0].Id,
		VersionId:     version.Id,
		EnvironmentId: &environment.Id,
		CreatedBy:     "test-user",
		CreatedAt:     baseTime,
	}
	st.PolicySkips.Upsert(ctx, policySkip)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 0: deploys immediately after approval (offset = 0)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds from approval (offset = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds from approval (offset = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result3.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SuccessPercentage tests that rollout starts
// when environment progression with only success percentage is satisfied
func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_SuccessPercentage(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	// Create releases and successful jobs in staging to satisfy 100% success rate

	successTime := baseTime.Add(1 * time.Hour) // Success happens 1 hour after version creation
	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := successTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
			CreatedAt:   successTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Create production release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: prodEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 0: deploys immediately after environment progression is satisfied
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: selector,
					MinimumSockTimeMinutes:       &soakMinutes,
				},
			},
		},
	}

	st.Policies.Upsert(ctx, envProgPolicy)

	// Create staging release target
	stagingRT := &oapi.ReleaseTarget{
		EnvironmentId: stagingEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingRT)

	// Create release and successful job in staging
	release := &oapi.Release{
		ReleaseTarget: *stagingRT,
		Version:       *version,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Job completes 1 hour after version creation
	jobCompletedAt := baseTime.Add(1 * time.Hour)
	job := &oapi.Job{
		Id:          "job-staging-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   baseTime,
		CompletedAt: &jobCompletedAt,
		UpdatedAt:   jobCompletedAt,
	}
	st.Jobs.Upsert(ctx, job)

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	// Position 0: deploys after soak time is satisfied
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	// Create releases and successful jobs in staging

	successTime := baseTime.Add(1 * time.Hour)
	lastJobCompletedAt := successTime.Add(2 * time.Minute) // Last job completes at this time
	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := successTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
			CreatedAt:   successTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	// Position 0: deploys after both conditions are satisfied (soak time is later)
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Create staging release targets but no jobs - environment progression NOT satisfied
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule.GradualRollout,
		ruleId:     rule.Id,
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
		Enabled:  true,
		Selector: "true",
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

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
			CreatedAt:   envProgTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	// Position 0: deploys after the later condition (environment progression)
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
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

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	// Position 0: deploys after the later condition (approval)
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	for i, rt := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := envProgTime.Add(time.Duration(i) * time.Minute)
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
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

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Create staging release targets but no jobs - environment progression NOT satisfied
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// Create production release target
	prodRT := &oapi.ReleaseTarget{
		EnvironmentId: prodEnv.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, prodRT)

	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: prodRT.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodRT.DeploymentId},
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

// TestGradualRolloutEvaluator_ApprovalJustSatisfied_OnlyPosition0Allowed tests the real-world scenario
// where approval is just satisfied and we check if only position 0 is allowed immediately,
// while other positions should still be pending
func TestGradualRolloutEvaluator_ApprovalJustSatisfied_OnlyPosition0Allowed(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	approvalTime := baseTime.Add(1 * time.Hour)

	// CRITICAL: Set current time to EXACTLY when approval is satisfied
	currentTime := approvalTime
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
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
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Check all positions at the exact moment approval is satisfied
	allowedCount := 0
	pendingCount := 0

	for i, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)

		t.Logf("Position %d: Allowed=%v, Message=%s, RolloutTime=%v",
			i, result.Allowed, result.Message, result.Details["target_rollout_time"])

		if result.Allowed {
			allowedCount++
		} else if result.ActionRequired && result.ActionType != nil && *result.ActionType == oapi.Wait {
			pendingCount++
		}
	}

	// CRITICAL CHECK: Only position 0 should be allowed, all others should be pending
	assert.Equal(t, 1, allowedCount, "Only position 0 should be allowed immediately after approval")
	assert.Equal(t, 4, pendingCount, "Positions 1-4 should be pending (waiting for their rollout time)")
}

// TestGradualRolloutEvaluator_GradualProgressionOverTime tests that as time advances,
// more positions become allowed in the correct order
func TestGradualRolloutEvaluator_GradualProgressionOverTime(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	approvalTime := baseTime.Add(1 * time.Hour)

	// Use a mutable time reference
	currentTime := approvalTime
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60) // 60 seconds between each position
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule.GradualRollout,
		ruleId:     rule.Id,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
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
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Time T+0: Only position 0 should be allowed
	currentTime = approvalTime
	allowedAtT0 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 1, allowedAtT0, "At T+0 (approval time), only position 0 should be allowed")

	// Time T+30s: Still only position 0 (position 1 needs 60s)
	currentTime = approvalTime.Add(30 * time.Second)
	allowedAtT30 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 1, allowedAtT30, "At T+30s, only position 0 should be allowed")

	// Time T+60s: Positions 0 and 1 should be allowed
	currentTime = approvalTime.Add(60 * time.Second)
	allowedAtT60 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 2, allowedAtT60, "At T+60s, positions 0 and 1 should be allowed")

	// Time T+120s: Positions 0, 1, and 2 should be allowed
	currentTime = approvalTime.Add(120 * time.Second)
	allowedAtT120 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 3, allowedAtT120, "At T+120s, positions 0, 1, and 2 should be allowed")

	// Time T+180s: Positions 0, 1, 2, and 3 should be allowed
	currentTime = approvalTime.Add(180 * time.Second)
	allowedAtT180 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 4, allowedAtT180, "At T+180s, positions 0, 1, 2, and 3 should be allowed")

	// Time T+240s: All 5 positions should be allowed
	currentTime = approvalTime.Add(240 * time.Second)
	allowedAtT240 := countAllowedTargets(ctx, t, eval, environment, version, releaseTargets)
	assert.Equal(t, 5, allowedAtT240, "At T+240s, all 5 positions should be allowed")
}

// Helper function to count how many targets are allowed at a given time
func countAllowedTargets(ctx context.Context, t *testing.T, eval GradualRolloutEvaluator,
	environment *oapi.Environment, version *oapi.DeploymentVersion,
	releaseTargets []*oapi.ReleaseTarget) int {

	allowedCount := 0
	for _, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)
		if result.Allowed {
			allowedCount++
		}
	}
	return allowedCount
}

// TestGradualRolloutEvaluator_EnvProgressionJustSatisfied_OnlyPosition0Allowed tests the scenario
// where environment progression is just satisfied and only position 0 should deploy immediately
func TestGradualRolloutEvaluator_EnvProgressionJustSatisfied_OnlyPosition0Allowed(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Staging jobs complete at this time
	stagingCompletionTime := baseTime.Add(1 * time.Hour)

	// CRITICAL: Set current time to EXACTLY when staging completes (env progression satisfied)
	currentTime := stagingCompletionTime
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		rule:       rule.GradualRollout,
		ruleId:     rule.Id,
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
		Enabled:  true,
		Selector: "true",
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

	// Create staging release targets for each resource
	stagingReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: stagingEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		stagingReleaseTargets[i] = releaseTarget
	}

	// Create successful staging jobs (all complete at stagingCompletionTime)
	for i, stagingRT := range stagingReleaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *stagingRT,
			Version:       *version,
		}
		_ = st.Releases.Upsert(ctx, release)

		completedAt := stagingCompletionTime
		job := &oapi.Job{
			Id:          fmt.Sprintf("job-staging-%d", i),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
			CreatedAt:   baseTime,
			CompletedAt: &completedAt,
			UpdatedAt:   completedAt,
		}
		st.Jobs.Upsert(ctx, job)
	}

	// Create production release targets for each resource
	prodReleaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: prodEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		prodReleaseTargets[i] = releaseTarget
	}

	// Check all positions at the exact moment staging completes
	allowedCount := 0
	pendingCount := 0

	for i, rt := range prodReleaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: prodEnv,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)

		t.Logf("Position %d: Allowed=%v, Message=%s, RolloutTime=%v",
			i, result.Allowed, result.Message, result.Details["target_rollout_time"])

		if result.Allowed {
			allowedCount++
		} else if result.ActionRequired && result.ActionType != nil && *result.ActionType == oapi.Wait {
			pendingCount++
		}
	}

	// CRITICAL CHECK: Only position 0 should be allowed, all others should be pending
	assert.Equal(t, 1, allowedCount, "Only position 0 should be allowed immediately after staging completes")
	assert.Equal(t, 4, pendingCount, "Positions 1-4 should be pending (waiting for their rollout time)")
}

// TestGradualRolloutEvaluator_NextEvaluationTime_WhenPending tests that NextEvaluationTime
// is properly set when a target is waiting for its rollout time.
func TestGradualRolloutEvaluator_NextEvaluationTime_WhenPending(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is 30 seconds after base time
	currentTime := baseTime.Add(30 * time.Second)
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60) // 60 seconds between deployments
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 1: should deploy at baseTime + 60 seconds, but current time is baseTime + 30 seconds
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	// Should be pending
	assert.False(t, result.Allowed, "position 1 should not be allowed yet")
	assert.True(t, result.ActionRequired, "should require action (waiting)")
	require.NotNil(t, result.ActionType)
	assert.Equal(t, oapi.Wait, *result.ActionType)

	// NextEvaluationTime should be set to the target rollout time
	require.NotNil(t, result.NextEvaluationTime, "NextEvaluationTime should be set when target is pending")
	expectedRolloutTime := baseTime.Add(60 * time.Second)
	assert.WithinDuration(t, expectedRolloutTime, *result.NextEvaluationTime, 1*time.Second,
		"NextEvaluationTime should be the target rollout time")
}

// TestGradualRolloutEvaluator_NextEvaluationTime_WhenAllowed tests that NextEvaluationTime
// is nil when a target is already allowed to deploy.
func TestGradualRolloutEvaluator_NextEvaluationTime_WhenAllowed(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is way past all rollout times
	currentTime := baseTime.Add(10 * time.Minute)
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// All positions should be allowed by now
	for i, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)

		assert.True(t, result.Allowed, "position %d should be allowed", i)
		assert.Nil(t, result.NextEvaluationTime, "NextEvaluationTime should be nil when target is allowed")
	}
}

// TestGradualRolloutEvaluator_NextEvaluationTime_WaitingForDependencies tests that NextEvaluationTime
// is nil when rollout hasn't started yet (waiting for approval or environment progression).
func TestGradualRolloutEvaluator_NextEvaluationTime_WaitingForDependencies(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 2, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	currentTime := baseTime.Add(2 * time.Hour)
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create approval policy requiring 2 approvals, but only provide 1
	approvalPolicy := &oapi.Policy{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, approvalPolicy)

	// Only 1 approval (need 2)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Format(time.RFC3339),
	})

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Check position 0 - should be pending (rollout hasn't started)
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "should not be allowed when rollout hasn't started")
	assert.True(t, result.ActionRequired, "should require action")
	assert.Equal(t, "Rollout has not started yet", result.Message)

	// NextEvaluationTime should be nil because we're waiting for approval (external dependency)
	assert.Nil(t, result.NextEvaluationTime,
		"NextEvaluationTime should be nil when waiting for external dependencies like approval")
}

// TestGradualRolloutEvaluator_EnvironmentProgressionNoReleaseTargets tests that when
// environment progression passes because there are no release targets in the dependent
// environment, gradual rollout starts immediately from version.CreatedAt
func TestGradualRolloutEvaluator_EnvironmentProgressionNoReleaseTargets(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	stagingEnv := generateEnvironment(ctx, systemID, st)
	stagingEnv.Name = "staging"
	_ = st.Environments.Upsert(ctx, stagingEnv)

	prodEnv := generateEnvironment(ctx, systemID, st)
	prodEnv.Name = "production"
	_ = st.Environments.Upsert(ctx, prodEnv)

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

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
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
		Enabled:  true,
		Selector: "true",
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

	// CRITICAL: Don't create any staging release targets
	// This means environment progression should pass with satisfiedAt = version.CreatedAt

	// Create production release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: prodEnv.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 0: should deploy immediately from version.CreatedAt (offset = 0)
	scope1 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be version.CreatedAt since no staging targets exist
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result1.Details["target_rollout_time"])

	// Position 1: deploys after 60 seconds from version.CreatedAt (offset = 60 seconds)
	scope2 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, versionCreatedAt.Add(60*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])

	// Position 2: deploys after 120 seconds from version.CreatedAt (offset = 120 seconds)
	scope3 := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed)
	assert.Equal(t, int32(2), result3.Details["target_rollout_position"])
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result3.Details["rollout_start_time"])
	assert.Equal(t, versionCreatedAt.Add(120*time.Second).Format(time.RFC3339), result3.Details["target_rollout_time"])
}

// TestGradualRolloutEvaluator_NextEvaluationTime_LinearNormalized tests that NextEvaluationTime
// is correctly set for linear-normalized rollout strategy.
func TestGradualRolloutEvaluator_NextEvaluationTime_LinearNormalized(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 4, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is 10 seconds after base time
	currentTime := baseTime.Add(10 * time.Second)
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinearNormalized, 120) // Total 120 seconds for all
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Position 2: offset = (2/4) * 120 = 60 seconds
	// Should deploy at baseTime + 60 seconds, current time is baseTime + 10 seconds
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[2].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[2].DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "position 2 should not be allowed yet")
	assert.True(t, result.ActionRequired, "should require action")

	require.NotNil(t, result.NextEvaluationTime, "NextEvaluationTime should be set")
	expectedRolloutTime := baseTime.Add(60 * time.Second)
	assert.WithinDuration(t, expectedRolloutTime, *result.NextEvaluationTime, 1*time.Second,
		"NextEvaluationTime should match linear-normalized schedule")
}

// =============================================================================
// Deployment Window Integration Tests
// =============================================================================

func boolPtr(b bool) *bool {
	return &b
}

func stringPtr(s string) *string {
	return &s
}

// TestGradualRolloutEvaluator_DeploymentWindow_InsideAllowWindow tests that when the version
// is created inside an allow window, rollout starts immediately from version creation time.
func TestGradualRolloutEvaluator_DeploymentWindow_InsideAllowWindow(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Version created at 10:00 AM (inside 9am-5pm window)
	baseTime := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC) // Monday
	twoHoursLater := baseTime.Add(2 * time.Hour)

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with deployment window (9am-5pm weekdays = allow window)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deployment-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					// Every day at 9am UTC
					Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480, // 8 hours (9am-5pm)
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(true),
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Position 0: should deploy immediately from version.CreatedAt (no window adjustment needed)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should be allowed")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be version.CreatedAt since we're inside the window
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result1.Details["rollout_start_time"])
}

// TestGradualRolloutEvaluator_DeploymentWindow_OutsideAllowWindow tests that when the version
// is created outside an allow window, rollout starts when the window opens.
func TestGradualRolloutEvaluator_DeploymentWindow_OutsideAllowWindow(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Version created at 11pm (OUTSIDE 9am-5pm window)
	// Window will next open at 9am the next day
	baseTime := time.Date(2025, 1, 6, 23, 0, 0, 0, time.UTC)       // Monday 11pm
	nextWindowStart := time.Date(2025, 1, 7, 9, 0, 0, 0, time.UTC) // Tuesday 9am

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is Tuesday 10am (inside the window)
	currentTime := time.Date(2025, 1, 7, 10, 0, 0, 0, time.UTC)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with deployment window (9am-5pm daily = allow window)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deployment-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480, // 8 hours (9am-5pm)
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(true),
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Position 0: rollout start time should be adjusted to window open (9am)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should be allowed (current time is after adjusted rollout start)")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be adjusted to window open time, not version.CreatedAt
	assert.Equal(t, nextWindowStart.Format(time.RFC3339), result1.Details["rollout_start_time"],
		"rollout should start when window opens, not when version was created")

	// Position 1: should deploy 60 seconds after window opens
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[1].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[1].DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed, "position 1 should be allowed")
	assert.Equal(t, int32(1), result2.Details["target_rollout_position"])
	expectedRolloutTime := nextWindowStart.Add(60 * time.Second)
	assert.Equal(t, expectedRolloutTime.Format(time.RFC3339), result2.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_IgnoresWindowWithoutDeployedVersion(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 1, st)

	versionCreatedAt := time.Date(2025, 1, 6, 23, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	currentTime := time.Date(2025, 1, 7, 10, 0, 0, 0, time.UTC)
	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deployment-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480,
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(true),
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	releaseTarget := &oapi.ReleaseTarget{
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "deployment window should be ignored without a deployed version")
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result.Details["rollout_start_time"])
}

// TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowAdjustsRolloutStart tests that
// when a version is created inside a deny window, the rollout start is pushed to when
// the deny window ends, preventing frontloading.
func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowAdjustsRolloutStart(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Version created at 2:30am Sunday (INSIDE 2am-6am deny window)
	versionCreatedAt := time.Date(2025, 1, 5, 2, 30, 0, 0, time.UTC)
	denyWindowEnd := time.Date(2025, 1, 5, 6, 0, 0, 0, time.UTC) // 6am
	currentTime := time.Date(2025, 1, 5, 6, 30, 0, 0, time.UTC)  // 6:30am (after deny window)

	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with DENY window (Sunday 2am-6am maintenance window)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deny-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 240, // 4 hours (2am-6am)
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(false), // DENY window
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Position 0: rollout start time should be pushed to deny window end (6am)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should be allowed")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	// Rollout start time should be pushed to deny window end, not version.CreatedAt
	assert.Equal(t, denyWindowEnd.Format(time.RFC3339), result1.Details["rollout_start_time"],
		"rollout should start when deny window ends, not when version was created")
}

// TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowOutsideNoChange tests that
// when a version is created outside a deny window, the rollout start is not affected.
func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowOutsideNoChange(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	// Version created at 10am (OUTSIDE 2am-6am deny window)
	versionCreatedAt := time.Date(2025, 1, 5, 10, 0, 0, 0, time.UTC)
	currentTime := time.Date(2025, 1, 5, 12, 0, 0, 0, time.UTC)

	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with DENY window (Sunday 2am-6am maintenance window)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deny-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 240, // 4 hours (2am-6am)
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(false), // DENY window
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Position 0: rollout start time should be version.CreatedAt (not inside deny window)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should be allowed")
	assert.Equal(t, int32(0), result1.Details["target_rollout_position"])
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result1.Details["rollout_start_time"],
		"rollout should start from version creation time when outside deny window")
}

// TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowPreventsFrontloading tests that
// deny windows prevent frontloading of deployments when the window ends.
func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowPreventsFrontloading(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	// Version created inside the deny window (3am, inside 2am-6am deny window)
	versionCreatedAt := time.Date(2025, 1, 5, 3, 0, 0, 0, time.UTC)
	denyWindowEnd := time.Date(2025, 1, 5, 6, 0, 0, 0, time.UTC) // 6am

	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is 6:05am (just after deny window ends)
	currentTime := time.Date(2025, 1, 5, 6, 5, 0, 0, time.UTC)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	// 60 second intervals between deployments
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with DENY window (2am-6am maintenance)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deny-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 240, // 4 hours (2am-6am)
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(false), // DENY window
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Test that deployments are properly spaced from deny window END time
	// Position 0: 6:00am (deny window ends)
	// Position 1: 6:01am
	// Position 2: 6:02am
	// etc.

	// At 6:05am, positions 0-4 should be allowed, position 5+ should be pending
	for i, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)

		expectedRolloutTime := denyWindowEnd.Add(time.Duration(i) * 60 * time.Second)

		if i <= 4 {
			assert.True(t, result.Allowed, "position %d should be allowed at 6:05am", i)
		} else {
			assert.False(t, result.Allowed, "position %d should be pending at 6:05am", i)
		}

		// Verify rollout start time is deny window end time, not version creation time
		assert.Equal(t, denyWindowEnd.Format(time.RFC3339), result.Details["rollout_start_time"],
			"rollout should start from deny window end time for position %d", i)

		// Verify individual target rollout times are spaced correctly
		assert.Equal(t, expectedRolloutTime.Format(time.RFC3339), result.Details["target_rollout_time"],
			"position %d should have correct rollout time", i)
	}
}

// TestGradualRolloutEvaluator_DeploymentWindow_NoWindowsExistingBehavior tests that
// when no deployment windows are configured, rollout behaves as before.
func TestGradualRolloutEvaluator_DeploymentWindow_NoWindowsExistingBehavior(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	twoHoursLater := baseTime.Add(2 * time.Hour)

	versionCreatedAt := baseTime
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return twoHoursLater
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// NO deployment window policy - just a policy with other rules
	otherPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "retry-rule",
				Retry: &oapi.RetryRule{
					MaxRetries: 3,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, otherPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Position 0: should use version.CreatedAt as rollout start
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTargets[0].ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTargets[0].DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "position 0 should be allowed")
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result1.Details["rollout_start_time"],
		"rollout should start from version creation time when no windows configured")
}

// TestGradualRolloutEvaluator_DeploymentWindow_PreventsFrontloading tests that
// deployment windows prevent frontloading of deployments when the window opens.
func TestGradualRolloutEvaluator_DeploymentWindow_PreventsFrontloading(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	// Version created at midnight (OUTSIDE 9am-5pm window)
	// Without window adjustment, targets 0-17 would all be scheduled before 9am
	// and would all deploy at 9am simultaneously (frontloading!)
	versionCreatedAt := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC) // Monday midnight
	windowOpenTime := time.Date(2025, 1, 6, 9, 0, 0, 0, time.UTC)   // Monday 9am
	version := generateDeploymentVersion(ctx, deployment.Id, versionCreatedAt, st)

	// Current time is 9:05am (just after window opens)
	currentTime := time.Date(2025, 1, 6, 9, 5, 0, 0, time.UTC)

	hashingFn := getHashingFunc(st)
	timeGetter := func() time.Time {
		return currentTime
	}

	// 60 second intervals between deployments
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := GradualRolloutEvaluator{
		store:      st,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	// Create policy with deployment window (9am-5pm daily)
	deploymentWindowPolicy := &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{
				Id: "deployment-window-rule",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480, // 8 hours
					Timezone:        stringPtr("UTC"),
					AllowWindow:     boolPtr(true),
				},
			},
		},
	}
	st.Policies.Upsert(ctx, deploymentWindowPolicy)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}
	seedSuccessfulReleaseTargets(ctx, st, releaseTargets)

	// Test that deployments are properly spaced from window open time
	// Position 0: 9:00am (window opens)
	// Position 1: 9:01am
	// Position 2: 9:02am
	// etc.

	// At 9:05am, positions 0-4 should be allowed, position 5 should be pending
	for i, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ctx, scope)

		expectedRolloutTime := windowOpenTime.Add(time.Duration(i) * 60 * time.Second)

		if i <= 4 {
			// Positions 0-4 have rollout times at or before 9:04am, should be allowed at 9:05am
			assert.True(t, result.Allowed, "position %d should be allowed at 9:05am", i)
		} else {
			// Position 5+ has rollout time at 9:05am or later, should be pending
			assert.False(t, result.Allowed, "position %d should be pending at 9:05am", i)
			assert.True(t, result.ActionRequired, "position %d should require action", i)
		}

		// Verify rollout start time is window open time, not version creation time
		assert.Equal(t, windowOpenTime.Format(time.RFC3339), result.Details["rollout_start_time"],
			"rollout should start from window open time for position %d", i)

		// Verify individual target rollout times are spaced correctly
		assert.Equal(t, expectedRolloutTime.Format(time.RFC3339), result.Details["target_rollout_time"],
			"position %d should have correct rollout time", i)
	}
}
