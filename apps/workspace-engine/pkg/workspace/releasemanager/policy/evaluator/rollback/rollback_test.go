package rollback

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	jobs          map[string]*oapi.Job
	verifications map[string][]*oapi.JobVerification
}

func (m *mockGetters) GetJobsForReleaseTarget(_ *oapi.ReleaseTarget) map[string]*oapi.Job {
	return m.jobs
}

func (m *mockGetters) GetJobVerificationsByJobId(jobId string) []*oapi.JobVerification {
	if m.verifications == nil {
		return nil
	}
	return m.verifications[jobId]
}

func newTestScope() evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: uuid.New().String(), Name: "production"},
		Resource: &oapi.Resource{
			Id:         uuid.New().String(),
			Identifier: "test-resource",
			Kind:       "service",
		},
		Deployment: &oapi.Deployment{
			Id:   uuid.New().String(),
			Name: "test-deployment",
			Slug: "test-deployment",
		},
		Version: &oapi.DeploymentVersion{
			Id:        uuid.New().String(),
			Tag:       "v1.0.0",
			CreatedAt: time.Now(),
		},
	}
}

func TestNewEvaluator_NilInputs(t *testing.T) {
	mock := &mockGetters{}

	assert.Nil(t, NewEvaluator(nil, nil))
	assert.Nil(t, NewEvaluator(mock, nil))

	rule := &oapi.PolicyRule{Id: "r1", Rollback: &oapi.RollbackRule{}}
	assert.Nil(t, NewEvaluator(nil, rule))

	ruleNoRollback := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewEvaluator(mock, ruleNoRollback))
}

func TestNewEvaluator_ValidInput(t *testing.T) {
	mock := &mockGetters{}
	rule := &oapi.PolicyRule{Id: "r1", Rollback: &oapi.RollbackRule{}}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)
	assert.Equal(t, "rollback", eval.RuleType())
	assert.Equal(t, "r1", eval.RuleId())
}

func TestRollbackEvaluator_NoJobs(t *testing.T) {
	mock := &mockGetters{}

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no jobs exist")
}

func TestRollbackEvaluator_JobStatusTriggersRollback(t *testing.T) {
	jobId := uuid.New().String()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			jobId: {Id: jobId, Status: oapi.JobStatusFailure, CreatedAt: time.Now()},
		},
	}

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny when latest job has a rollback status")
}

func TestRollbackEvaluator_JobStatusNotInRollbackStatuses(t *testing.T) {
	jobId := uuid.New().String()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			jobId: {Id: jobId, Status: oapi.JobStatusSuccessful, CreatedAt: time.Now()},
		},
	}

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when job status not in rollback statuses")
}

func TestRollbackEvaluator_VerificationFailure(t *testing.T) {
	jobId := uuid.New().String()
	now := time.Now()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			jobId: {Id: jobId, Status: oapi.JobStatusSuccessful, CreatedAt: now},
		},
		verifications: map[string][]*oapi.JobVerification{
			jobId: {
				{
					Id:        uuid.New().String(),
					JobId:     jobId,
					CreatedAt: now,
					Metrics: []oapi.VerificationMetricStatus{
						{
							Name:  "test-metric",
							Count: 1,
							Measurements: []oapi.VerificationMeasurement{
								{MeasuredAt: now, Status: oapi.Failed},
							},
						},
					},
				},
			},
		},
	}

	onVerificationFailure := true
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny when verification has failed")
}

func TestRollbackEvaluator_VerificationNoFailure(t *testing.T) {
	jobId := uuid.New().String()
	now := time.Now()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			jobId: {Id: jobId, Status: oapi.JobStatusSuccessful, CreatedAt: now},
		},
		verifications: map[string][]*oapi.JobVerification{
			jobId: {
				{
					Id:        uuid.New().String(),
					JobId:     jobId,
					CreatedAt: now,
					Metrics: []oapi.VerificationMetricStatus{
						{
							Name:  "test-metric",
							Count: 1,
							Measurements: []oapi.VerificationMeasurement{
								{MeasuredAt: now, Status: oapi.Passed},
							},
						},
					},
				},
			},
		},
	}

	onVerificationFailure := true
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no verification failures")
}

func TestRollbackEvaluator_VerificationDisabled(t *testing.T) {
	jobId := uuid.New().String()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			jobId: {Id: jobId, Status: oapi.JobStatusSuccessful, CreatedAt: time.Now()},
		},
	}

	onVerificationFailure := false
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnVerificationFailure: &onVerificationFailure,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when verification check is disabled")
}

func TestRollbackEvaluator_MultipleJobsPicksLatest(t *testing.T) {
	oldJobId := uuid.New().String()
	newJobId := uuid.New().String()
	mock := &mockGetters{
		jobs: map[string]*oapi.Job{
			oldJobId: {
				Id:        oldJobId,
				Status:    oapi.JobStatusSuccessful,
				CreatedAt: time.Now().Add(-1 * time.Hour),
			},
			newJobId: {Id: newJobId, Status: oapi.JobStatusFailure, CreatedAt: time.Now()},
		},
	}

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.PolicyRule{
		Id: "rollback-1",
		Rollback: &oapi.RollbackRule{
			OnJobStatuses: &statuses,
		},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	scope := newTestScope()
	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should deny because latest job is failed")
}

func TestRollbackEvaluator_ScopeFieldsAndMetadata(t *testing.T) {
	mock := &mockGetters{}
	rule := &oapi.PolicyRule{
		Id:       "rollback-scope",
		Rollback: &oapi.RollbackRule{},
	}
	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)
	assert.Equal(t, "rollback", eval.RuleType())
	assert.Equal(t, "rollback-scope", eval.RuleId())
}
