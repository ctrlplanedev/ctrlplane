package approval

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupStore creates a test store with approval records and a test environment.
func setupStore(versionId string, environmentId string, approvers []string) *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(context.Background(), env)

	for _, userId := range approvers {
		record := &oapi.UserApprovalRecord{
			VersionId:     versionId,
			EnvironmentId: environmentId,
			UserId:        userId,
			Status:        oapi.ApprovalStatusApproved,
		}
		st.UserApprovalRecords.Upsert(context.Background(), record)
	}

	return st
}

func TestAnyApprovalEvaluator_EnoughApprovals(t *testing.T) {
	// Setup: 3 approvers, need 2
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2", "user-3"})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)
	require.NotNil(t, eval, "evaluator should not be nil")

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed, got denied: %s", result.Message)
	assert.Equal(t, 2, result.Details["min_approvals"], "expected min_approvals=2")

	approvers, ok := result.Details["approvers"].([]string)
	require.True(t, ok, "expected approvers to be []string")
	assert.Len(t, approvers, 3, "expected 3 approvers")
}

func TestAnyApprovalEvaluator_NotEnoughApprovals(t *testing.T) {
	// Setup: 1 approver, need 3
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1"})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 3}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied, got allowed: %s", result.Message)
	assert.Equal(t, 3, result.Details["min_approvals"], "expected min_approvals=3")

	approvers, ok := result.Details["approvers"].([]string)
	require.True(t, ok, "expected approvers to be []string")
	assert.Len(t, approvers, 1, "expected 1 approver")
}

func TestAnyApprovalEvaluator_ExactlyMinApprovals(t *testing.T) {
	// Setup: 2 approvers, need 2 (exact match)
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2"})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed when approvals exactly meet minimum")

	approvers, ok := result.Details["approvers"].([]string)
	require.True(t, ok, "expected approvers to be []string")
	assert.Len(t, approvers, 2, "expected 2 approvers")
}

func TestAnyApprovalEvaluator_NoApprovalsRequired(t *testing.T) {
	// Setup: 0 approvals required (rule disabled)
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 0}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed when no approvals required")
	assert.Equal(t, "No approvals required", result.Message)
}

func TestAnyApprovalEvaluator_NoApprovalsGiven(t *testing.T) {
	// Setup: 0 approvers, need 1
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied when no approvals given")

	approvers, ok := result.Details["approvers"].([]string)
	require.True(t, ok, "expected approvers to be []string")
	assert.Empty(t, approvers, "expected 0 approvers")
}

func TestAnyApprovalEvaluator_MultipleVersionsIsolated(t *testing.T) {
	// Setup: Different approval counts for different versions
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	environmentId := "env-1"
	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	// Version 1: 2 approvals
	for _, userId := range []string{"user-1", "user-2"} {
		st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
			VersionId:     "version-1",
			EnvironmentId: environmentId,
			UserId:        userId,
			Status:        oapi.ApprovalStatusApproved,
		})
	}

	// Version 2: 1 approval
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     "version-2",
		EnvironmentId: environmentId,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
	})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)
	environment, _ := st.Environments.Get(environmentId)

	// Test version-1 (2 approvals, should pass)
	scope1 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     &oapi.DeploymentVersion{Id: "version-1"},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "expected version-1 allowed (has 2 approvals)")

	// Test version-2 (1 approval, should fail)
	scope2 := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     &oapi.DeploymentVersion{Id: "version-2"},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.False(t, result2.Allowed, "expected version-2 denied (has 1 approval)")

	// Verify approvers are version-specific
	approvers1 := result1.Details["approvers"].([]string)
	assert.Len(t, approvers1, 2, "expected 2 approvers for version-1")

	approvers2 := result2.Details["approvers"].([]string)
	assert.Len(t, approvers2, 1, "expected 1 approver for version-2")
}

func TestAnyApprovalEvaluator_ResultStructure(t *testing.T) {
	// Verify result has all expected fields and proper types
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1"})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	require.NotNil(t, result.Details, "expected Details to be initialized")
	assert.Contains(t, result.Details, "min_approvals", "expected Details to contain 'min_approvals'")
	assert.Contains(t, result.Details, "approvers", "expected Details to contain 'approvers'")
	assert.NotEmpty(t, result.Message, "expected Message to be set")

	// Verify approvers is correct type
	approvers, ok := result.Details["approvers"].([]string)
	require.True(t, ok, "expected approvers to be []string")
	assert.Len(t, approvers, 1, "expected 1 approver")
}

func TestAnyApprovalEvaluator_ExceedsMinimum(t *testing.T) {
	// Setup: More approvals than required
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2", "user-3", "user-4", "user-5"})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed when approvals exceed minimum (5 > 2)")

	approvers := result.Details["approvers"].([]string)
	assert.Len(t, approvers, 5, "expected 5 approvers")
}

func TestAnyApprovalEvaluator_SatisfiedAt_ExactlyMinApprovals(t *testing.T) {
	// Test that satisfiedAt is set to the timestamp of the Nth approval (where N = minApprovals)
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	// Create approval records with specific timestamps
	// We need 2 approvals, so the 2nd approval (index 1) should be the satisfying one
	baseTime := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)

	firstApprovalTime := baseTime.Add(5 * time.Minute)
	secondApprovalTime := baseTime.Add(10 * time.Minute) // This should be the satisfiedAt timestamp
	thirdApprovalTime := baseTime.Add(15 * time.Minute)

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     firstApprovalTime.Format(time.RFC3339),
	})

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     secondApprovalTime.Format(time.RFC3339),
	})

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     thirdApprovalTime.Format(time.RFC3339),
	})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, secondApprovalTime, *result.SatisfiedAt, "satisfiedAt should be the timestamp of the 2nd approval (the one that satisfied the requirement)")
}

func TestAnyApprovalEvaluator_SatisfiedAt_MoreThanMinApprovals(t *testing.T) {
	// Test that satisfiedAt uses the Nth approval even when there are more approvals
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	// Create 5 approvals, but only need 2
	baseTime := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)

	firstApprovalTime := baseTime.Add(5 * time.Minute)
	secondApprovalTime := baseTime.Add(10 * time.Minute) // This should be the satisfiedAt (2nd approval)
	thirdApprovalTime := baseTime.Add(15 * time.Minute)
	fourthApprovalTime := baseTime.Add(20 * time.Minute)
	fifthApprovalTime := baseTime.Add(25 * time.Minute)

	approvalTimes := []time.Time{firstApprovalTime, secondApprovalTime, thirdApprovalTime, fourthApprovalTime, fifthApprovalTime}
	for i, approvalTime := range approvalTimes {
		st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
			VersionId:     versionId,
			EnvironmentId: environmentId,
			UserId:        fmt.Sprintf("user-%d", i+1),
			Status:        oapi.ApprovalStatusApproved,
			CreatedAt:     approvalTime.Format(time.RFC3339),
		})
	}

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, secondApprovalTime, *result.SatisfiedAt, "satisfiedAt should be the timestamp of the 2nd approval, not the 5th")
}

func TestAnyApprovalEvaluator_SatisfiedAt_SingleApproval(t *testing.T) {
	// Test with minApprovals = 1, so the first approval should be the satisfying one
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	firstApprovalTime := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	secondApprovalTime := firstApprovalTime.Add(5 * time.Minute)

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     firstApprovalTime.Format(time.RFC3339),
	})

	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     secondApprovalTime.Format(time.RFC3339),
	})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, firstApprovalTime, *result.SatisfiedAt, "satisfiedAt should be the timestamp of the 1st approval")
}

func TestAnyApprovalEvaluator_SatisfiedAt_NotSatisfied(t *testing.T) {
	// Test that satisfiedAt is nil when approvals are not satisfied
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	// Only 1 approval, but need 3
	approvalTime := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 3}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied")
	assert.Nil(t, result.SatisfiedAt, "satisfiedAt should be nil when approvals are not satisfied")
}

func TestAnyApprovalEvaluator_SatisfiedAt_NoApprovalsRequired(t *testing.T) {
	// Test that satisfiedAt uses version.CreatedAt when no approvals are required
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:        versionId,
		CreatedAt: versionCreatedAt,
	}

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 0}}
	eval := NewEvaluator(st, rule.AnyApproval)

	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, versionCreatedAt, *result.SatisfiedAt, "satisfiedAt should be version.CreatedAt when no approvals required")
}

func TestAnyApprovalEvaluator_SatisfiedAt_OutOfOrderApprovals(t *testing.T) {
	// Test that satisfiedAt uses the correct approval even if approvals are created out of order
	// The store sorts by CreatedAt, so we should get the Nth approval by creation time, not insertion order
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	versionId := "version-1"
	environmentId := "env-1"

	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	baseTime := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)

	// Create approvals out of chronological order
	// First approval (created later, but inserted first)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Add(15 * time.Minute).Format(time.RFC3339),
	})

	// Second approval (created first, but inserted second)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Add(5 * time.Minute).Format(time.RFC3339), // This is the 2nd approval by creation time
	})

	// Third approval (created middle)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     baseTime.Add(10 * time.Minute).Format(time.RFC3339),
	})

	// Need 2 approvals, so the 2nd approval by creation time should be the satisfying one
	expectedSatisfiedAt := baseTime.Add(10 * time.Minute) // This is the 2nd approval chronologically

	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be based on creation time order, not insertion order")
}

// TestAnyApprovalEvaluator_AlreadyDeployed tests that if a version has already been deployed
// to an environment, it should be allowed without requiring new approvals.
func TestAnyApprovalEvaluator_AlreadyDeployed(t *testing.T) {
	ctx := context.Background()
	versionId := "version-1"
	environmentId := "env-1"

	// Setup store with no approvals (should normally fail)
	st := setupStore(versionId, environmentId, []string{})

	// Create a deployment
	jobAgentId := "agent-1"
	deployment := &oapi.Deployment{
		Id:         "deploy-1",
		Name:       "my-app",
		SystemId:   "system-1",
		JobAgentId: &jobAgentId,
	}
	st.Deployments.Upsert(ctx, deployment)

	// Create version
	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           versionId,
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create a release target
	rt := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: environmentId,
		DeploymentId:  "deploy-1",
	}

	// Create a release showing this version was already deployed to this environment
	release := &oapi.Release{
		ReleaseTarget: *rt,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release)

	// Rule requires 2 approvals, but we have none
	rule := &oapi.PolicyRule{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}}
	eval := NewEvaluator(st, rule.AnyApproval)
	require.NotNil(t, eval, "evaluator should not be nil")

	environment, _ := st.Environments.Get(environmentId)

	// Act
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert: Should be allowed because version was already deployed to this environment
	assert.True(t, result.Allowed, "expected allowed because version already deployed to this environment")
	assert.Contains(t, result.Message, "already deployed")
	assert.Equal(t, versionId, result.Details["version_id"])
	assert.Equal(t, environmentId, result.Details["environment_id"])
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, versionCreatedAt, *result.SatisfiedAt, "satisfiedAt should be version creation time")
}
