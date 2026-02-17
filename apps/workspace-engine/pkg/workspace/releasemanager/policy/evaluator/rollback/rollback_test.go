package rollback

import (
	"context"
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

func setupTestStore(t *testing.T) (*store.Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	sc := statechange.NewChangeSet[any]()
	s := store.New("test-workspace", sc)
	return s, ctx
}

type testEntities struct {
	deployment *oapi.Deployment
	env        *oapi.Environment
	resource   *oapi.Resource
	rt         *oapi.ReleaseTarget
	version    *oapi.DeploymentVersion
}

func setupEntities(t *testing.T, s *store.Store, ctx context.Context) testEntities {
	t.Helper()

	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}
	require.NoError(t, s.Deployments.Upsert(ctx, deployment))

	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}
	require.NoError(t, s.Environments.Upsert(ctx, env))

	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource",
		Kind:       "service",
	}
	_, err := s.Resources.Upsert(ctx, resource)
	require.NoError(t, err)

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env.Id,
		ResourceId:    resource.Id,
	}
	s.ReleaseTargets.Upsert(ctx, rt)

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, version.Id, version)

	return testEntities{
		deployment: deployment,
		env:        env,
		resource:   resource,
		rt:         rt,
		version:    version,
	}
}

func createJob(t *testing.T, s *store.Store, ctx context.Context, e testEntities, status oapi.JobStatus, createdAt time.Time) *oapi.Job {
	t.Helper()

	// Create release to link job to release target
	release := &oapi.Release{
		ReleaseTarget: *e.rt,
		Version:       *e.version,
		CreatedAt:     createdAt.Format(time.RFC3339),
	}
	require.NoError(t, s.Releases.Upsert(ctx, release))

	completedAt := createdAt.Add(30 * time.Second)
	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    status,
		CreatedAt: createdAt,
	}
	if status == oapi.JobStatusSuccessful || status == oapi.JobStatusFailure {
		job.CompletedAt = &completedAt
	}
	s.Jobs.Upsert(ctx, job)
	return job
}

func createScope(e testEntities) evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: e.env,
		Resource:    e.resource,
		Deployment:  e.deployment,
		Version:     e.version,
	}
}

func TestNewEvaluator_NilInputs(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	s := store.New("ws", sc)

	assert.Nil(t, NewEvaluator(nil, nil))
	assert.Nil(t, NewEvaluator(s, nil))

	rule := &oapi.PolicyRule{Id: "r1", Rollback: &oapi.RollbackRule{}}
	assert.Nil(t, NewEvaluator(nil, rule))

	ruleNoRollback := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewEvaluator(s, ruleNoRollback))
}

func TestNewEvaluator_ValidInput(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	s := store.New("ws", sc)
	rule := &oapi.PolicyRule{Id: "r1", Rollback: &oapi.RollbackRule{}}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)
	assert.Equal(t, "rollback", eval.RuleType())
	assert.Equal(t, "r1", eval.RuleId())
}

func TestRollbackEvaluator_NoJobs(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no jobs exist")
}

func TestRollbackEvaluator_JobStatusTriggersRollback(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	createJob(t, s, ctx, e, oapi.JobStatusFailure, time.Now())

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny when latest job has a rollback status")
}

func TestRollbackEvaluator_JobStatusNotInRollbackStatuses(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	createJob(t, s, ctx, e, oapi.JobStatusSuccessful, time.Now())

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when job status not in rollback statuses")
}

func TestRollbackEvaluator_VerificationFailure(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	job := createJob(t, s, ctx, e, oapi.JobStatusSuccessful, time.Now())

	now := time.Now()
	verification := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     job.Id,
		CreatedAt: now,
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:  "test-metric",
				Count: 1,
				Measurements: []oapi.VerificationMeasurement{
					{
						MeasuredAt: now,
						Status:     oapi.Failed,
					},
				},
			},
		},
	}
	s.JobVerifications.Upsert(ctx, verification)

	onVerificationFailure := true
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny when verification has failed")
}

func TestRollbackEvaluator_VerificationNoFailure(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	job := createJob(t, s, ctx, e, oapi.JobStatusSuccessful, time.Now())

	now := time.Now()
	verification := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     job.Id,
		CreatedAt: now,
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:  "test-metric",
				Count: 1,
				Measurements: []oapi.VerificationMeasurement{
					{
						MeasuredAt: now,
						Status:     oapi.Passed,
					},
				},
			},
		},
	}
	s.JobVerifications.Upsert(ctx, verification)

	onVerificationFailure := true
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no verification failures")
}

func TestRollbackEvaluator_VerificationDisabled(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	createJob(t, s, ctx, e, oapi.JobStatusSuccessful, time.Now())

	onVerificationFailure := false
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when verification check is disabled")
}

func TestRollbackEvaluator_MultipleJobsPicksLatest(t *testing.T) {
	s, ctx := setupTestStore(t)
	e := setupEntities(t, s, ctx)

	// Old successful job
	createJob(t, s, ctx, e, oapi.JobStatusSuccessful, time.Now().Add(-1*time.Hour))

	// Create a new version for a newer release
	e2 := e
	e2.version = &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: e.deployment.Id,
		Tag:          "v2.0.0",
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, e2.version.Id, e2.version)

	// Newer failed job
	createJob(t, s, ctx, e2, oapi.JobStatusFailure, time.Now())

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := createScope(e)
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny because latest job is failed")
}

func TestRollbackEvaluator_ScopeFieldsAndMetadata(t *testing.T) {
	s, _ := setupTestStore(t)
	rule := &oapi.PolicyRule{
		Id:       "rollback-scope",
		Rollback: &oapi.RollbackRule{},
	}
	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)
	assert.Equal(t, "rollback", eval.RuleType())
	assert.Equal(t, "rollback-scope", eval.RuleId())
}
