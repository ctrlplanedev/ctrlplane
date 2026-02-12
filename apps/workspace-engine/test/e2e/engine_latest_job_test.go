package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// getReleaseTarget is a helper that returns the single release target from a
// workspace, or fails the test if the count isn't exactly 1.
func getReleaseTarget(t *testing.T, engine *integration.TestWorkspace) *oapi.ReleaseTarget {
	t.Helper()
	rts, err := engine.Workspace().ReleaseTargets().Items()
	require.NoError(t, err)
	require.Equal(t, 1, len(rts), "expected exactly 1 release target")
	for _, rt := range rts {
		return rt
	}
	return nil // unreachable
}

// getState is a helper that returns the release target state for a given target.
func getState(t *testing.T, ctx context.Context, engine *integration.TestWorkspace, rt *oapi.ReleaseTarget) *oapi.ReleaseTargetState {
	t.Helper()
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	return state
}

// findJobForVersion returns the job that belongs to the given version tag.
func findJobForVersion(engine *integration.TestWorkspace, versionTag string) *oapi.Job {
	for _, j := range engine.Workspace().Jobs().Items() {
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if ok && release.Version.Tag == versionTag {
			return j
		}
	}
	return nil
}

// newBaseTestWorkspace creates a workspace with one deployment, one environment,
// and one resource — the minimal setup for a single release target.
func newBaseTestWorkspace(t *testing.T) (*integration.TestWorkspace, string) {
	t.Helper()
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	return integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	), deploymentID
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

// TestEngine_LatestJob_NilWhenNoJobs verifies that LatestJob is nil when no
// deployment versions (and therefore no jobs) exist.
func TestEngine_LatestJob_NilWhenNoJobs(t *testing.T) {
	engine, _ := newBaseTestWorkspace(t)
	ctx := context.Background()

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	assert.Nil(t, state.LatestJob, "LatestJob should be nil when no jobs exist")
}

// TestEngine_LatestJob_PopulatedAfterVersionCreate verifies that after creating
// a deployment version (which triggers job creation), LatestJob is populated
// with the pending job.
func TestEngine_LatestJob_PopulatedAfterVersionCreate(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	require.NotNil(t, state.LatestJob, "LatestJob should be populated after job creation")
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status,
		"LatestJob should be in pending state after version create")
}

// TestEngine_LatestJob_ReflectsStatusTransitions verifies that LatestJob
// correctly tracks a job through pending → in-progress → successful.
func TestEngine_LatestJob_ReflectsStatusTransitions(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	// Create a version → pending job.
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	rt := getReleaseTarget(t, engine)

	// ---- Pending ----
	state := getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status)

	job := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job, "job for v1.0.0 must exist")

	// ---- In-progress ----
	job.Status = oapi.JobStatusInProgress
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job.Id, Job: *job})

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusInProgress, state.LatestJob.Job.Status,
		"LatestJob should reflect in-progress status")

	// ---- Successful ----
	now := time.Now()
	job.Status = oapi.JobStatusSuccessful
	job.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job.Id, Job: *job})

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status,
		"LatestJob should reflect successful status")
}

// TestEngine_LatestJob_PointsToNewestJob verifies that when multiple jobs
// exist (multiple versions deployed), LatestJob points to the newest one.
func TestEngine_LatestJob_PointsToNewestJob(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	// Deploy v1 and complete it.
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	job1 := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job1)
	now := time.Now()
	job1.Status = oapi.JobStatusSuccessful
	job1.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job1.Id, Job: *job1})

	// Deploy v2 — creates a new pending job.
	v2 := c.NewDeploymentVersion()
	v2.DeploymentId = deploymentID
	v2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v2)

	job2 := findJobForVersion(engine, "v2.0.0")
	require.NotNil(t, job2, "job for v2.0.0 must exist")

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	require.NotNil(t, state.LatestJob,
		"LatestJob should be populated when jobs exist")
	assert.Equal(t, job2.Id, state.LatestJob.Job.Id,
		"LatestJob should point to the newest job (v2.0.0)")
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status,
		"LatestJob should reflect the pending v2.0.0 job")
}

// TestEngine_LatestJob_ReflectsFailedJob verifies that LatestJob correctly
// reports a failed job status (and doesn't fall back to the previous
// successful job).
func TestEngine_LatestJob_ReflectsFailedJob(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	// Deploy v1 and complete it successfully.
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	job1 := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job1)
	now := time.Now()
	job1.Status = oapi.JobStatusSuccessful
	job1.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job1.Id, Job: *job1})

	// Deploy v2 and fail it.
	v2 := c.NewDeploymentVersion()
	v2.DeploymentId = deploymentID
	v2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v2)

	job2 := findJobForVersion(engine, "v2.0.0")
	require.NotNil(t, job2)
	now2 := time.Now()
	job2.Status = oapi.JobStatusFailure
	job2.CompletedAt = &now2
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job2.Id, Job: *job2})

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	require.NotNil(t, state.LatestJob,
		"LatestJob should not be nil when a failed job exists")
	assert.Equal(t, job2.Id, state.LatestJob.Job.Id,
		"LatestJob should be the failed v2.0.0 job, not the successful v1.0.0 job")
	assert.Equal(t, oapi.JobStatusFailure, state.LatestJob.Job.Status,
		"LatestJob status should be failure")
}

// TestEngine_LatestJob_UpdatedAfterJobStatusChange verifies that the state
// index is refreshed when a job status changes via HandleJobUpdated. This is
// the critical path: HandleJobUpdated → DirtyCurrentAndJob → RecomputeState.
func TestEngine_LatestJob_UpdatedAfterJobStatusChange(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	rt := getReleaseTarget(t, engine)

	// Before any update — job is pending.
	state := getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	initialJobID := state.LatestJob.Job.Id
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status)

	// Update job to successful.
	job := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job)
	now := time.Now()
	job.Status = oapi.JobStatusSuccessful
	job.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job.Id, Job: *job})

	// After update — same job, new status.
	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, initialJobID, state.LatestJob.Job.Id,
		"LatestJob should still be the same job")
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status,
		"LatestJob should reflect updated successful status")
	assert.NotNil(t, state.LatestJob.Job.CompletedAt,
		"LatestJob should have CompletedAt set after successful completion")
}

// TestEngine_LatestJob_ConsistentWithCurrentRelease verifies that LatestJob
// and CurrentRelease are consistent: when the latest job is successful, the
// CurrentRelease should match the same version.
func TestEngine_LatestJob_ConsistentWithCurrentRelease(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	// Complete the job.
	job := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job)
	now := time.Now()
	job.Status = oapi.JobStatusSuccessful
	job.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job.Id, Job: *job})

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	require.NotNil(t, state.LatestJob, "LatestJob should exist")
	require.NotNil(t, state.CurrentRelease, "CurrentRelease should exist after successful job")

	// Both should reference the same release.
	latestJobRelease, ok := engine.Workspace().Releases().Get(state.LatestJob.Job.ReleaseId)
	require.True(t, ok, "release for latest job should exist")
	assert.Equal(t, state.CurrentRelease.Version.Tag, latestJobRelease.Version.Tag,
		"LatestJob and CurrentRelease should be for the same version when latest job is successful")
}

// TestEngine_LatestJob_DivergentFromCurrentReleaseOnFailure verifies that when
// the latest job fails, LatestJob reflects the failed job while
// CurrentRelease still points to the last successful deployment.
func TestEngine_LatestJob_DivergentFromCurrentReleaseOnFailure(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()

	// Deploy v1 successfully.
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	job1 := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job1)
	now := time.Now()
	job1.Status = oapi.JobStatusSuccessful
	job1.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job1.Id, Job: *job1})

	// Deploy v2, then fail it.
	v2 := c.NewDeploymentVersion()
	v2.DeploymentId = deploymentID
	v2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v2)

	job2 := findJobForVersion(engine, "v2.0.0")
	require.NotNil(t, job2)
	now2 := time.Now()
	job2.Status = oapi.JobStatusFailure
	job2.CompletedAt = &now2
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job2.Id, Job: *job2})

	rt := getReleaseTarget(t, engine)
	state := getState(t, ctx, engine, rt)

	// LatestJob → failed v2.0.0.
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusFailure, state.LatestJob.Job.Status)
	latestJobRelease, ok := engine.Workspace().Releases().Get(state.LatestJob.Job.ReleaseId)
	require.True(t, ok)
	assert.Equal(t, "v2.0.0", latestJobRelease.Version.Tag,
		"LatestJob should point to the failed v2.0.0 job")

	// CurrentRelease → still v1.0.0 (last successful).
	require.NotNil(t, state.CurrentRelease,
		"CurrentRelease should still exist (v1.0.0)")
	assert.Equal(t, "v1.0.0", state.CurrentRelease.Version.Tag,
		"CurrentRelease should still be v1.0.0 after v2.0.0 failed")
}

// TestEngine_LatestJob_MultipleReleaseTargetsIndependent verifies that
// LatestJob is tracked independently per release target: completing a job
// on one target doesn't affect the other.
func TestEngine_LatestJob_MultipleReleaseTargetsIndependent(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceName("resource-2"),
		),
	)

	ctx := context.Background()

	// Create version → jobs for both release targets.
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	rts, err := engine.Workspace().ReleaseTargets().Items()
	require.NoError(t, err)
	require.Equal(t, 2, len(rts))

	jobs := engine.Workspace().Jobs().Items()
	require.Equal(t, 2, len(jobs), "each release target should have a job")

	// Before any updates, verify both targets have LatestJob populated.
	for _, rt := range rts {
		state := getState(t, ctx, engine, rt)
		require.NotNil(t, state.LatestJob,
			"LatestJob should be populated for every release target after version create (resource=%s)", rt.ResourceId)
		assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status,
			"LatestJob should be pending before any updates (resource=%s)", rt.ResourceId)
	}

	// Pick one job to complete and identify the release targets.
	var completedJob *oapi.Job
	for _, j := range jobs {
		completedJob = j
		break
	}
	require.NotNil(t, completedJob)

	completedRelease, ok := engine.Workspace().Releases().Get(completedJob.ReleaseId)
	require.True(t, ok)

	var completedReleaseTarget, pendingReleaseTarget *oapi.ReleaseTarget
	for _, rt := range rts {
		if rt.ResourceId == completedRelease.ReleaseTarget.ResourceId {
			completedReleaseTarget = rt
		} else {
			pendingReleaseTarget = rt
		}
	}
	require.NotNil(t, completedReleaseTarget, "should find completed release target")
	require.NotNil(t, pendingReleaseTarget, "should find pending release target")

	// Complete the job.
	now := time.Now()
	completedJob.Status = oapi.JobStatusSuccessful
	completedJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &completedJob.Id, Job: *completedJob})

	// Completed target → LatestJob is successful.
	state1 := getState(t, ctx, engine, completedReleaseTarget)
	require.NotNil(t, state1.LatestJob)
	assert.Equal(t, oapi.JobStatusSuccessful, state1.LatestJob.Job.Status,
		"LatestJob for the completed release target should be successful")

	// Pending target → LatestJob is still pending.
	state2 := getState(t, ctx, engine, pendingReleaseTarget)
	require.NotNil(t, state2.LatestJob,
		"LatestJob for the pending release target should not be nil")
	assert.Equal(t, oapi.JobStatusPending, state2.LatestJob.Job.Status,
		"LatestJob for the pending release target should still be pending")
}

// TestEngine_LatestJob_ThreeVersionLifecycle exercises a full three-version
// lifecycle and verifies LatestJob at each stage:
//
//	v1 created (pending) → v1 succeeds → v2 created (pending) → v2 fails →
//	v3 created (pending) → v3 succeeds
func TestEngine_LatestJob_ThreeVersionLifecycle(t *testing.T) {
	engine, deploymentID := newBaseTestWorkspace(t)
	ctx := context.Background()
	rt := getReleaseTarget(t, engine)

	// ---- v1 created ----
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	state := getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status)
	job1 := findJobForVersion(engine, "v1.0.0")
	require.NotNil(t, job1)
	assert.Equal(t, job1.Id, state.LatestJob.Job.Id)

	// ---- v1 succeeds ----
	now := time.Now()
	job1.Status = oapi.JobStatusSuccessful
	job1.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job1.Id, Job: *job1})

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status)
	assert.Equal(t, job1.Id, state.LatestJob.Job.Id)

	// ---- v2 created (new pending job) ----
	v2 := c.NewDeploymentVersion()
	v2.DeploymentId = deploymentID
	v2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v2)

	job2 := findJobForVersion(engine, "v2.0.0")
	require.NotNil(t, job2, "job for v2.0.0 must exist")

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, job2.Id, state.LatestJob.Job.Id,
		"LatestJob should switch to v2.0.0's job")
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status)

	// ---- v2 fails ----
	now2 := time.Now()
	job2.Status = oapi.JobStatusFailure
	job2.CompletedAt = &now2
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job2.Id, Job: *job2})

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, job2.Id, state.LatestJob.Job.Id,
		"LatestJob should still be v2.0.0's job even after failure")
	assert.Equal(t, oapi.JobStatusFailure, state.LatestJob.Job.Status)

	// CurrentRelease should still be v1.0.0.
	require.NotNil(t, state.CurrentRelease)
	assert.Equal(t, "v1.0.0", state.CurrentRelease.Version.Tag)

	// ---- v3 created (new pending job) ----
	v3 := c.NewDeploymentVersion()
	v3.DeploymentId = deploymentID
	v3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v3)

	job3 := findJobForVersion(engine, "v3.0.0")
	require.NotNil(t, job3, "job for v3.0.0 must exist")

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, job3.Id, state.LatestJob.Job.Id,
		"LatestJob should switch to v3.0.0's job")
	assert.Equal(t, oapi.JobStatusPending, state.LatestJob.Job.Status)

	// ---- v3 succeeds ----
	now3 := time.Now()
	job3.Status = oapi.JobStatusSuccessful
	job3.CompletedAt = &now3
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{Id: &job3.Id, Job: *job3})

	state = getState(t, ctx, engine, rt)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, job3.Id, state.LatestJob.Job.Id)
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status)

	// CurrentRelease should now be v3.0.0.
	require.NotNil(t, state.CurrentRelease)
	assert.Equal(t, "v3.0.0", state.CurrentRelease.Version.Tag)
}
