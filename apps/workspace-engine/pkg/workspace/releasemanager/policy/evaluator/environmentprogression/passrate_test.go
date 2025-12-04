package environmentprogression

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestStoreForPassRate creates a minimal test store for pass rate evaluator tests
func setupTestStoreForPassRate() *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	// Create system
	system := &oapi.System{
		Id:          "system-1",
		Name:        "test-system",
		WorkspaceId: "workspace-1",
	}
	_ = st.Systems.Upsert(ctx, system)

	// Create resource selector that matches all resources
	resourceSelector := &oapi.Selector{}
	_ = resourceSelector.FromCelSelector(oapi.CelSelector{
		Cel: "true",
	})

	// Create environment
	env := &oapi.Environment{
		Id:               "env-staging",
		Name:             "staging",
		SystemId:         "system-1",
		ResourceSelector: resourceSelector,
	}
	st.Environments.Upsert(ctx, env)

	// Create deployment
	jobAgentId := "agent-1"
	description := "Test deployment"
	deployment := &oapi.Deployment{
		Id:               "deploy-1",
		Name:             "my-app",
		Slug:             "my-app",
		SystemId:         "system-1",
		JobAgentId:       &jobAgentId,
		Description:      &description,
		JobAgentConfig:   map[string]any{},
		ResourceSelector: resourceSelector,
	}
	st.Deployments.Upsert(ctx, deployment)

	return st
}

// TestPassRateEvaluator_MeetsMinimumRequirement tests that the evaluator allows progression
// when the success percentage meets or exceeds the minimum requirement.
func TestPassRateEvaluator_MeetsMinimumRequirement(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	// Create version
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create 3 release targets
	rt1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt1)

	rt2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt2)

	rt3 := &oapi.ReleaseTarget{
		ResourceId:    "resource-3",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt3)

	// Create releases
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *rt2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release3 := &oapi.Release{
		ReleaseTarget: *rt3,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)
	st.Releases.Upsert(ctx, release2)
	st.Releases.Upsert(ctx, release3)

	// Create resources for release targets
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Identifier:  "test-resource-3",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	st.Resources.Upsert(ctx, resource2)
	st.Resources.Upsert(ctx, resource3)
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err)

	// Create 2 successful jobs out of 3 targets (66.67% success)
	completedAt1 := time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	completedAt2 := time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC)
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release2.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)
	st.Jobs.Upsert(ctx, job2)

	// Test with 50% minimum requirement (66.67% > 50%, should pass)
	env, _ := st.Environments.Get("env-staging")
	minSuccessPercentage := float32(50.0)
	eval := NewPassRateEvaluator(st, minSuccessPercentage, nil)

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed for 66.67%% success with 50%% requirement")
	assert.False(t, result.ActionRequired, "expected no action required")
	// The actual percentage might vary slightly, so just check it contains the key parts
	assert.Contains(t, result.Message, "meets required 50.0%")
	actualPercentage := result.Details["success_percentage"].(float32)
	assert.GreaterOrEqual(t, actualPercentage, minSuccessPercentage, "success percentage should be >= minimum")
	assert.Equal(t, minSuccessPercentage, result.Details["minimum_success_percentage"])
}

// TestPassRateEvaluator_BelowMinimumRequirement tests that the evaluator denies progression
// when the success percentage is below the minimum requirement.
func TestPassRateEvaluator_BelowMinimumRequirement(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create 3 release targets
	rt1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt1)

	rt2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt2)

	rt3 := &oapi.ReleaseTarget{
		ResourceId:    "resource-3",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt3)

	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *rt2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release3 := &oapi.Release{
		ReleaseTarget: *rt3,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)
	st.Releases.Upsert(ctx, release2)
	st.Releases.Upsert(ctx, release3)

	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Identifier:  "test-resource-3",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	st.Resources.Upsert(ctx, resource2)
	st.Resources.Upsert(ctx, resource3)
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err)

	// Create only 1 successful job out of 3 targets (33.33% success)
	completedAt1 := time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Test with 50% minimum requirement (33.33% < 50%, should fail)
	env, _ := st.Environments.Get("env-staging")
	minSuccessPercentage := float32(50.0)
	eval := NewPassRateEvaluator(st, minSuccessPercentage, nil)

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied for 33.33%% success with 50%% requirement")
	assert.False(t, result.ActionRequired, "expected denied, not pending")
	// The actual percentage might vary, so just check it contains the key parts
	assert.Contains(t, result.Message, "below required 50.0%")
	actualPercentage := result.Details["success_percentage"].(float32)
	assert.Less(t, actualPercentage, minSuccessPercentage, "success percentage should be < minimum")
	assert.Equal(t, minSuccessPercentage, result.Details["minimum_success_percentage"])
}

// TestPassRateEvaluator_SatisfiedAt_ExactThreshold tests that satisfiedAt is set to the timestamp
// of the job that exactly met the minimum requirement.
func TestPassRateEvaluator_SatisfiedAt_ExactThreshold(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create 3 release targets
	rt1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt1)

	rt2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt2)

	rt3 := &oapi.ReleaseTarget{
		ResourceId:    "resource-3",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt3)

	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *rt2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release3 := &oapi.Release{
		ReleaseTarget: *rt3,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)
	st.Releases.Upsert(ctx, release2)
	st.Releases.Upsert(ctx, release3)

	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Identifier:  "test-resource-3",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	st.Resources.Upsert(ctx, resource2)
	st.Resources.Upsert(ctx, resource3)
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err)

	// Create jobs with specific timestamps
	// Job 1: 10:05 (33% success)
	completedAt1 := time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	// Job 2: 10:10 (66% success - meets 50% requirement, this should be satisfiedAt)
	satisfiedAtTime := time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC)
	completedAt2 := satisfiedAtTime
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release2.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	// Job 3: 10:15 (100% success)
	completedAt3 := time.Date(2024, 1, 1, 10, 15, 0, 0, time.UTC)
	job3 := &oapi.Job{
		Id:             "job-3",
		ReleaseId:      release3.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC),
		UpdatedAt:      completedAt3,
		CompletedAt:    &completedAt3,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)
	st.Jobs.Upsert(ctx, job2)
	st.Jobs.Upsert(ctx, job3)

	env, _ := st.Environments.Get("env-staging")
	minSuccessPercentage := float32(50.0)
	eval := NewPassRateEvaluator(st, minSuccessPercentage, nil)

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, satisfiedAtTime, *result.SatisfiedAt, "satisfiedAt should be when the 2nd job completed (when 50% threshold was met)")
}

// TestPassRateEvaluator_ZeroMinimumPercentage tests the special case where minimumSuccessPercentage is 0,
// which should require at least one successful job (not 0%).
func TestPassRateEvaluator_ZeroMinimumPercentage(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	rt1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt1)

	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create resource for release target
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Identifier:  "test-resource-1",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	st.Resources.Upsert(ctx, resource1)
	// Ensure ReleaseTargets are computed after adding resource
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err, "failed to get release targets")

	env, _ := st.Environments.Get("env-staging")

	// Create successful job before testing
	completedAt := time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Test with one successful job - should be allowed
	evalZero := NewPassRateEvaluator(st, 0.0, nil)
	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := evalZero.Evaluate(ctx, scope)
	assert.True(t, result.Allowed, "expected allowed with at least one successful job when minimum is 0. Result: %+v", result)
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set. Result: %+v", result)
	assert.Equal(t, completedAt, *result.SatisfiedAt, "satisfiedAt should be the earliest success time")
	assert.Contains(t, result.Message, "at least one successful job")
}

// TestPassRateEvaluator_NoReleaseTargets tests the edge case where there are no release targets.
func TestPassRateEvaluator_NoReleaseTargets(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	env, _ := st.Environments.Get("env-staging")
	minSuccessPercentage := float32(50.0)
	eval := NewPassRateEvaluator(st, minSuccessPercentage, nil)

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// With no release targets, success percentage is 0%
	assert.False(t, result.Allowed, "expected denied with no release targets")
	assert.Contains(t, result.Message, "Success rate 0.0% below required 50.0%")
}

// TestPassRateEvaluator_CustomSuccessStatuses tests that custom success statuses can be used.
func TestPassRateEvaluator_CustomSuccessStatuses(t *testing.T) {
	st := setupTestStoreForPassRate()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	rt1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, rt1)

	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create resource for release target
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Identifier:  "test-resource-1",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	st.Resources.Upsert(ctx, resource1)
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err, "failed to get release targets")

	// Create a job with InProgress status (which we'll treat as successful)
	completedAt := time.Now().Add(-5 * time.Minute)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusInProgress,
		CreatedAt:      time.Now().Add(-10 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	// Use custom success statuses that include InProgress
	customSuccessStatuses := map[oapi.JobStatus]bool{
		oapi.JobStatusInProgress: true,
	}
	minSuccessPercentage := float32(0.0) // Require at least one "successful" job
	eval := NewPassRateEvaluator(st, minSuccessPercentage, customSuccessStatuses)

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Should be allowed because InProgress is treated as a success status
	assert.True(t, result.Allowed, "expected allowed with InProgress job when InProgress is a success status")
}
