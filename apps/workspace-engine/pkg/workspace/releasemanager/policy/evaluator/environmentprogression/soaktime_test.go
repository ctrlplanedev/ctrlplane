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

// setupTestStoreForSoakTime creates a minimal test store for soak time evaluator tests
func setupTestStoreForSoakTime() *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	// Create system
	system := &oapi.System{
		Id:          "system-1",
		Name:        "test-system",
		WorkspaceId: "workspace-1",
	}
	st.Systems.Upsert(ctx, system)

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

// TestSoakTimeEvaluator_SoakTimeMet tests that the evaluator allows progression when the soak
// time requirement has been met (most recent success completed more than soakDuration ago).
func TestSoakTimeEvaluator_SoakTimeMet(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create a successful job that completed 40 minutes ago
	// With 30 minute soak time, this should be satisfied
	soakMinutes := int32(30)
	mostRecentSuccess := time.Now().Add(-40 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when soak time is met")
	assert.False(t, result.ActionRequired, "expected no action required")
	assert.Contains(t, result.Message, "Soak time requirement met")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	expectedSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be mostRecentSuccess + soakDuration")
}

// TestSoakTimeEvaluator_SoakTimeNotMet tests that the evaluator returns a pending result when
// the soak time requirement has not been met (most recent success completed less than soakDuration ago).
func TestSoakTimeEvaluator_SoakTimeNotMet(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create a successful job that completed only 10 minutes ago
	// With 30 minute soak time, this should not be satisfied
	soakMinutes := int32(30)
	mostRecentSuccess := time.Now().Add(-10 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected not allowed when soak time is not met")
	assert.True(t, result.ActionRequired, "expected action required (waiting for soak time)")
	assert.Contains(t, result.Message, "Soak time required")
	assert.Contains(t, result.Message, "Time remaining")
	assert.NotNil(t, result.Details["soak_time_remaining_minutes"])
	assert.Nil(t, result.SatisfiedAt, "satisfiedAt should be nil when requirement is not satisfied")
}

// TestSoakTimeEvaluator_NoSuccessfulJobs tests that the evaluator denies when there are no successful jobs.
func TestSoakTimeEvaluator_NoSuccessfulJobs(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create a pending job (not successful)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Pending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	soakMinutes := int32(30)
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied with no successful jobs")
	assert.False(t, result.ActionRequired, "expected denied, not pending")
	assert.Contains(t, result.Message, "No successful jobs for soak time check")
	assert.Nil(t, result.SatisfiedAt, "satisfiedAt should be nil when no successful jobs")
}

// TestSoakTimeEvaluator_SatisfiedAt_Calculation tests that satisfiedAt is correctly calculated
// as mostRecentSuccess + soakDuration when the requirement is met.
func TestSoakTimeEvaluator_SatisfiedAt_Calculation(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Use fixed time for predictable results
	soakMinutes := int32(15)
	mostRecentSuccess := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Since mostRecentSuccess is in the past, soak time should be satisfied
	// satisfiedAt = mostRecentSuccess + soakDuration
	expectedSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	assert.True(t, result.Allowed, "expected allowed when soak time is satisfied")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be mostRecentSuccess + soakDuration")
}

// TestSoakTimeEvaluator_MultipleJobs_UseMostRecent tests that the evaluator uses the most recent
// successful job completion time for soak time calculation.
func TestSoakTimeEvaluator_MultipleJobs_UseMostRecent(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	soakMinutes := int32(30)

	// Use fixed times to avoid timing issues during test execution
	// Create an older successful job
	oldSuccess := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	completedAt1 := oldSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      oldSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Create a more recent successful job (20 minutes after the old one)
	// This is still in the past, so soak time won't be met
	mostRecentSuccess := time.Date(2024, 1, 1, 10, 20, 0, 0, time.UTC)
	completedAt2 := mostRecentSuccess
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job2)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Should use the most recent success, which is in the past, so soak time should be met
	// (time.Since(mostRecentSuccess) will be very large, so soakTimeRemaining will be negative)
	assert.True(t, result.Allowed, "expected allowed when mostRecentSuccess is in the past (soak time met)")
	assert.False(t, result.ActionRequired, "expected no action required")
	assert.NotNil(t, result.Details["most_recent_success"], "should include most recent success in details")
	require.NotNil(t, result.SatisfiedAt, "satisfiedAt should be set when requirement is met")
	expectedSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be mostRecentSuccess + soakDuration")
}

// TestSoakTimeEvaluator_ZeroOrNegativeSoakMinutes tests that NewSoakTimeEvaluator returns nil
// when soakMinutes is zero or negative.
func TestSoakTimeEvaluator_ZeroOrNegativeSoakMinutes(t *testing.T) {
	st := setupTestStoreForSoakTime()

	// Test with zero minutes
	eval1 := NewSoakTimeEvaluator(st, 0, nil)
	assert.Nil(t, eval1, "expected nil evaluator when soakMinutes is 0")

	// Test with negative minutes
	eval2 := NewSoakTimeEvaluator(st, -10, nil)
	assert.Nil(t, eval2, "expected nil evaluator when soakMinutes is negative")
}

// TestSoakTimeEvaluator_CustomSuccessStatuses tests that custom success statuses can be used.
func TestSoakTimeEvaluator_CustomSuccessStatuses(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	// Create a job with InProgress status (which we'll treat as successful)
	soakMinutes := int32(30)
	mostRecentSuccess := time.Now().Add(-40 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.InProgress,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	// Use custom success statuses that include InProgress
	customSuccessStatuses := map[oapi.JobStatus]bool{
		oapi.InProgress: true,
	}
	eval := NewSoakTimeEvaluator(st, soakMinutes, customSuccessStatuses)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Should be allowed because InProgress is treated as a success status
	assert.True(t, result.Allowed, "expected allowed with InProgress job when InProgress is a success status")
	assert.Contains(t, result.Message, "Soak time requirement met")
}

// TestSoakTimeEvaluator_ExactlyAtThreshold tests the edge case where the most recent success
// completed exactly at the soak time threshold.
func TestSoakTimeEvaluator_ExactlyAtThreshold(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	soakMinutes := int32(30)
	// Create a job that completed exactly 30 minutes ago
	mostRecentSuccess := time.Now().Add(-30 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// At exactly the threshold, soak time should be met (soakTimeRemaining should be <= 0)
	// Due to timing precision, this might be slightly positive, so we'll check it's close
	assert.True(t, result.Allowed, "expected allowed when most recent success is at or past the soak time threshold")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	expectedSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be mostRecentSuccess + soakDuration")
}

// TestSoakTimeEvaluator_NextEvaluationTime_WhenPending tests that NextEvaluationTime is properly set
// when soak time is still pending (not yet met).
func TestSoakTimeEvaluator_NextEvaluationTime_WhenPending(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	soakMinutes := int32(30)
	// Job completed 10 minutes ago - soak time of 30 minutes NOT met yet
	mostRecentSuccess := time.Now().Add(-10 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Soak time not met - should be pending
	assert.False(t, result.Allowed, "expected not allowed when soak time not met")
	assert.True(t, result.ActionRequired, "expected action required")

	// NextEvaluationTime should be set to when soak time will be satisfied
	require.NotNil(t, result.NextEvaluationTime, "NextEvaluationTime should be set when soak time is pending")
	expectedNextEvalTime := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	assert.WithinDuration(t, expectedNextEvalTime, *result.NextEvaluationTime, 1*time.Second,
		"NextEvaluationTime should be when soak time will be satisfied")
}

// TestSoakTimeEvaluator_NextEvaluationTime_WhenSatisfied tests that NextEvaluationTime is nil
// when soak time is already satisfied.
func TestSoakTimeEvaluator_NextEvaluationTime_WhenSatisfied(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	release1 := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, release1)

	soakMinutes := int32(30)
	// Job completed 40 minutes ago - soak time of 30 minutes IS met
	mostRecentSuccess := time.Now().Add(-40 * time.Minute)
	completedAt := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	env, _ := st.Environments.Get("env-staging")
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Soak time met - should be allowed
	assert.True(t, result.Allowed, "expected allowed when soak time is met")
	assert.False(t, result.ActionRequired, "expected no action required")

	// NextEvaluationTime should be nil because policy is satisfied
	assert.Nil(t, result.NextEvaluationTime, "NextEvaluationTime should be nil when soak time is already satisfied")
}

// TestSoakTimeEvaluator_NextEvaluationTime_NoJobs tests that NextEvaluationTime is nil
// when there are no successful jobs (policy is denied, not pending).
func TestSoakTimeEvaluator_NextEvaluationTime_NoJobs(t *testing.T) {
	st := setupTestStoreForSoakTime()
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
	soakMinutes := int32(30)
	eval := NewSoakTimeEvaluator(st, soakMinutes, nil)
	require.NotNil(t, eval, "evaluator should not be nil")

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// No jobs - should be denied (not pending)
	assert.False(t, result.Allowed, "expected denied when no jobs exist")
	assert.False(t, result.ActionRequired, "expected denied, not pending")

	// NextEvaluationTime should be nil because we can't evaluate without a successful job
	assert.Nil(t, result.NextEvaluationTime, "NextEvaluationTime should be nil when no successful jobs exist")
}
