package releasetargetconcurrency_test

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/releasetargetconcurrency"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupStore creates a test store.
func setupStore() *store.Store {
	cs := statechange.NewChangeSet[any]()
	return store.New(cs)
}

func TestReleaseTargetConcurrencyEvaluator_NoActiveJobs(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	target := &oapi.ReleaseTarget{
		ResourceId:    "server-1",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// No jobs exist, so the target should be allowed
	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when no jobs are active")
	assert.Equal(t, "Release target has no active jobs", result.Message)
}

func TestReleaseTargetConcurrencyEvaluator_WithPendingJob(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-1",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create a pending job for the release
	job := &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.Pending,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when job is pending")
	assert.Equal(t, "Release target has an active job", result.Message)
	assert.Contains(t, result.Details, "release_target", "should include release target key")
	assert.Contains(t, result.Details, "job_job-1", "should include job status")
}

func TestReleaseTargetConcurrencyEvaluator_WithInProgressJob(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-2",
		EnvironmentId: "staging",
		DeploymentId:  "web",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create an in-progress job for the release
	job := &oapi.Job{
		Id:        "job-2",
		ReleaseId: release.ID(),
		Status:    oapi.InProgress,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when job is in progress")
	assert.Equal(t, "Release target has an active job", result.Message)
	assert.Contains(t, result.Details, "release_target")
	assert.Contains(t, result.Details, "job_job-2")
	assert.Equal(t, oapi.InProgress, result.Details["job_job-2"])
}

func TestReleaseTargetConcurrencyEvaluator_WithActionRequiredJob(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-3",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create an action-required job for the release
	job := &oapi.Job{
		Id:        "job-3",
		ReleaseId: release.ID(),
		Status:    oapi.ActionRequired,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when job requires action")
	assert.Equal(t, "Release target has an active job", result.Message)
	assert.Contains(t, result.Details, "job_job-3")
	assert.Equal(t, oapi.ActionRequired, result.Details["job_job-3"])
}

func TestReleaseTargetConcurrencyEvaluator_WithMultipleProcessingJobs(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-4",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create multiple processing jobs
	job1 := &oapi.Job{
		Id:        "job-4a",
		ReleaseId: release.ID(),
		Status:    oapi.Pending,
	}
	job2 := &oapi.Job{
		Id:        "job-4b",
		ReleaseId: release.ID(),
		Status:    oapi.InProgress,
	}
	st.Jobs.Upsert(ctx, job1)
	st.Jobs.Upsert(ctx, job2)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when multiple jobs are active")
	assert.Equal(t, "Release target has an active job", result.Message)
	assert.Contains(t, result.Details, "job_job-4a")
	assert.Contains(t, result.Details, "job_job-4b")
}

func TestReleaseTargetConcurrencyEvaluator_WithCompletedJob(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-5",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create a completed job (terminal state, not processing)
	job := &oapi.Job{
		Id:        "job-5",
		ReleaseId: release.ID(),
		Status:    oapi.Successful,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	// Completed jobs should not block new deployments
	assert.True(t, result.Allowed, "expected allowed when only completed jobs exist")
	assert.Equal(t, "Release target has no active jobs", result.Message)
}

func TestReleaseTargetConcurrencyEvaluator_WithCancelledJob(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-6",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create a cancelled job (terminal state, not processing)
	job := &oapi.Job{
		Id:        "job-6",
		ReleaseId: release.ID(),
		Status:    oapi.Cancelled,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	// Cancelled jobs should not block new deployments
	assert.True(t, result.Allowed, "expected allowed when only cancelled jobs exist")
	assert.Equal(t, "Release target has no active jobs", result.Message)
}

func TestReleaseTargetConcurrencyEvaluator_DifferentTargets(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target1 := &oapi.ReleaseTarget{
		ResourceId:    "server-7",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}
	target2 := &oapi.ReleaseTarget{
		ResourceId:    "server-8",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release for target1
	release1 := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target1,
	}
	_ = st.Releases.Upsert(ctx, release1)

	// Create a processing job for target1
	job := &oapi.Job{
		Id:        "job-7",
		ReleaseId: release1.ID(),
		Status:    oapi.InProgress,
	}
	st.Jobs.Upsert(ctx, job)

	// Evaluate target1 - should be denied
	scope1 := evaluator.EvaluatorScope{
		ReleaseTarget: target1,
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.False(t, result1.Allowed, "target1 should be denied (has active job)")

	// Evaluate target2 - should be allowed (no jobs)
	scope2 := evaluator.EvaluatorScope{
		ReleaseTarget: target2,
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.True(t, result2.Allowed, "target2 should be allowed (no jobs)")
}

func TestReleaseTargetConcurrencyEvaluator_MissingReleaseTarget(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Scope without release target
	scope := evaluator.EvaluatorScope{
		Version: &oapi.DeploymentVersion{
			Id:     "v1.0.0",
			Status: oapi.DeploymentVersionStatusReady,
		},
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when release target is missing")
	assert.Contains(t, result.Message, "missing", "message should indicate field is missing")
}

func TestReleaseTargetConcurrencyEvaluator_ScopeFields(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)

	scopeFields := eval.ScopeFields()

	assert.Equal(t, evaluator.ScopeReleaseTarget, scopeFields, "should only require ReleaseTarget scope field")
}

func TestReleaseTargetConcurrencyEvaluator_Memoization(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	target := &oapi.ReleaseTarget{
		ResourceId:    "server-9",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	// First evaluation
	result1 := eval.Evaluate(ctx, scope)

	// Second evaluation with same scope - should return cached result
	result2 := eval.Evaluate(ctx, scope)

	// Since the evaluator is wrapped with memoization, the results should be the same instance
	assert.Equal(t, result1, result2, "should return cached result for same scope")
	assert.True(t, result1.Allowed, "both results should be allowed (no jobs)")
}

func TestReleaseTargetConcurrencyEvaluator_ResultDetails(t *testing.T) {
	st := setupStore()
	eval := releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(st)
	ctx := context.Background()

	// Create test data with active job
	version := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-10",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	// Create a release
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Create a job
	job := &oapi.Job{
		Id:        "job-10",
		ReleaseId: release.ID(),
		Status:    oapi.InProgress,
	}
	st.Jobs.Upsert(ctx, job)

	scope := evaluator.EvaluatorScope{
		ReleaseTarget: target,
	}

	result := eval.Evaluate(ctx, scope)

	// Verify result structure
	require.NotNil(t, result.Details, "details should be initialized")
	assert.Contains(t, result.Details, "release_target", "should contain release_target")
	assert.Equal(t, target.Key(), result.Details["release_target"], "release_target detail should match target key")
	assert.Contains(t, result.Details, "job_job-10", "should contain job status")
	assert.Equal(t, oapi.InProgress, result.Details["job_job-10"], "job status detail should match")
}

