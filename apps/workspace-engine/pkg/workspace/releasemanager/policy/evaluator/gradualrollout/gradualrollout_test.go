package gradualrollout

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
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

func TestGradualRolloutEvaluator_BasicLinearRollout(t *testing.T) {
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

	rule := &oapi.GradualRolloutRule{
		TimeScaleInterval: 60,
	}
	evaluator := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	key1 := fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)
	releaseTarget1 := st.ReleaseTargets.Get(key1)
	if releaseTarget1 == nil {
		t.Fatalf("release target not found: %s", key1)
	}

	key2 := fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)
	releaseTarget2 := st.ReleaseTargets.Get(key2)
	if releaseTarget2 == nil {
		t.Fatalf("release target not found: %s", key2)
	}

	key3 := fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)
	releaseTarget3 := st.ReleaseTargets.Get(key3)
	if releaseTarget3 == nil {
		t.Fatalf("release target not found: %s", key3)
	}

	result1, err := evaluator.Evaluate(ctx, environment, version, releaseTarget1)
	if err != nil {
		t.Fatalf("error evaluating release target 1: %v", err)
	}

	assert.True(t, result1.Allowed)
	assert.False(t, result1.ActionRequired)
	assert.Nil(t, result1.ActionType)
	assert.Equal(t, result1.Message, "Rollout has progressed to this release target")

	result2, err := evaluator.Evaluate(ctx, environment, version, releaseTarget2)
	if err != nil {
		t.Fatalf("error evaluating release target 2: %v", err)
	}

	assert.True(t, result2.Allowed)
	assert.False(t, result2.ActionRequired)
	assert.Nil(t, result2.ActionType)
	assert.Equal(t, result2.Message, "Rollout has progressed to this release target")

	result3, err := evaluator.Evaluate(ctx, environment, version, releaseTarget3)
	if err != nil {
		t.Fatalf("error evaluating release target 3: %v", err)
	}

	assert.False(t, result3.Allowed)
	assert.True(t, result3.ActionRequired)
	assert.Equal(t, *result3.ActionType, oapi.Wait)
	assert.Equal(t, result3.Message, "Rollout will start at 2025-01-01T02:00:00Z for this release target")
}

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

	rule := &oapi.GradualRolloutRule{
		TimeScaleInterval: 0,
	}
	evaluator := GradualRolloutEvaluator{
		store:      st,
		rule:       rule,
		hashingFn:  hashingFn,
		timeGetter: timeGetter,
	}

	key1 := fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)
	releaseTarget1 := st.ReleaseTargets.Get(key1)
	if releaseTarget1 == nil {
		t.Fatalf("release target not found: %s", key1)
	}

	key2 := fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)
	releaseTarget2 := st.ReleaseTargets.Get(key2)
	if releaseTarget2 == nil {
		t.Fatalf("release target not found: %s", key2)
	}

	key3 := fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)
	releaseTarget3 := st.ReleaseTargets.Get(key3)
	if releaseTarget3 == nil {
		t.Fatalf("release target not found: %s", key3)
	}

	result1, err := evaluator.Evaluate(ctx, environment, version, releaseTarget1)
	if err != nil {
		t.Fatalf("error evaluating release target 1: %v", err)
	}

	assert.True(t, result1.Allowed)
	assert.False(t, result1.ActionRequired)
	assert.Nil(t, result1.ActionType)
	assert.Equal(t, result1.Message, "Rollout has progressed to this release target")

	result2, err := evaluator.Evaluate(ctx, environment, version, releaseTarget2)
	if err != nil {
		t.Fatalf("error evaluating release target 2: %v", err)
	}

	assert.True(t, result2.Allowed)
	assert.False(t, result2.ActionRequired)
	assert.Nil(t, result2.ActionType)
	assert.Equal(t, result2.Message, "Rollout has progressed to this release target")

	result3, err := evaluator.Evaluate(ctx, environment, version, releaseTarget3)
	if err != nil {
		t.Fatalf("error evaluating release target 3: %v", err)
	}

	assert.True(t, result3.Allowed)
	assert.False(t, result3.ActionRequired)
	assert.Nil(t, result3.ActionType)
	assert.Equal(t, result3.Message, "Rollout has progressed to this release target")
}

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

	rule := &oapi.GradualRolloutRule{
		TimeScaleInterval: 60,
	}
	evaluator := GradualRolloutEvaluator{
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

	key1 := fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)
	releaseTarget1 := st.ReleaseTargets.Get(key1)
	if releaseTarget1 == nil {
		t.Fatalf("release target not found: %s", key1)
	}

	key2 := fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)
	releaseTarget2 := st.ReleaseTargets.Get(key2)
	if releaseTarget2 == nil {
		t.Fatalf("release target not found: %s", key2)
	}

	key3 := fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)
	releaseTarget3 := st.ReleaseTargets.Get(key3)
	if releaseTarget3 == nil {
		t.Fatalf("release target not found: %s", key3)
	}

	result1, err := evaluator.Evaluate(ctx, environment, version, releaseTarget1)
	if err != nil {
		t.Fatalf("error evaluating release target 1: %v", err)
	}

	assert.False(t, result1.Allowed)
	assert.True(t, result1.ActionRequired)
	assert.Equal(t, *result1.ActionType, oapi.Wait)
	assert.Equal(t, result1.Message, "Rollout has not started yet")

	result2, err := evaluator.Evaluate(ctx, environment, version, releaseTarget2)
	if err != nil {
		t.Fatalf("error evaluating release target 2: %v", err)
	}

	assert.False(t, result2.Allowed)
	assert.True(t, result2.ActionRequired)
	assert.Equal(t, *result2.ActionType, oapi.Wait)
	assert.Equal(t, result2.Message, "Rollout has not started yet")

	result3, err := evaluator.Evaluate(ctx, environment, version, releaseTarget3)
	if err != nil {
		t.Fatalf("error evaluating release target 3: %v", err)
	}

	assert.False(t, result3.Allowed)
	assert.True(t, result3.ActionRequired)
	assert.Equal(t, *result3.ActionType, oapi.Wait)
	assert.Equal(t, result3.Message, "Rollout has not started yet")
}

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

	rule := &oapi.GradualRolloutRule{
		TimeScaleInterval: 60,
	}
	evaluator := GradualRolloutEvaluator{
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

	key1 := fmt.Sprintf("%s-%s-%s", resources[0].Id, environment.Id, deployment.Id)
	releaseTarget1 := st.ReleaseTargets.Get(key1)
	if releaseTarget1 == nil {
		t.Fatalf("release target not found: %s", key1)
	}

	key2 := fmt.Sprintf("%s-%s-%s", resources[1].Id, environment.Id, deployment.Id)
	releaseTarget2 := st.ReleaseTargets.Get(key2)
	if releaseTarget2 == nil {
		t.Fatalf("release target not found: %s", key2)
	}

	key3 := fmt.Sprintf("%s-%s-%s", resources[2].Id, environment.Id, deployment.Id)
	releaseTarget3 := st.ReleaseTargets.Get(key3)
	if releaseTarget3 == nil {
		t.Fatalf("release target not found: %s", key3)
	}

	result1, err := evaluator.Evaluate(ctx, environment, version, releaseTarget1)
	if err != nil {
		t.Fatalf("error evaluating release target 1: %v", err)
	}

	assert.True(t, result1.Allowed)
	assert.False(t, result1.ActionRequired)
	assert.Nil(t, result1.ActionType)
	assert.Equal(t, result1.Message, "Rollout has progressed to this release target")

	result2, err := evaluator.Evaluate(ctx, environment, version, releaseTarget2)
	if err != nil {
		t.Fatalf("error evaluating release target 2: %v", err)
	}

	assert.True(t, result2.Allowed)
	assert.False(t, result2.ActionRequired)
	assert.Nil(t, result2.ActionType)
	assert.Equal(t, result2.Message, "Rollout has progressed to this release target")

	result3, err := evaluator.Evaluate(ctx, environment, version, releaseTarget3)
	if err != nil {
		t.Fatalf("error evaluating release target 3: %v", err)
	}

	assert.False(t, result3.Allowed)
	assert.True(t, result3.ActionRequired)
	assert.Equal(t, *result3.ActionType, oapi.Wait)
	assert.Equal(t, result3.Message, "Rollout will start at 2025-01-01T03:00:00Z for this release target")
}
