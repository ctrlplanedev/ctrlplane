package store_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetByJobId(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	// Create multiple verifications for the same job
	verification1 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now().Add(-1 * time.Hour),
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	verification2 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now(),
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	s.JobVerifications.Upsert(ctx, verification1)
	s.JobVerifications.Upsert(ctx, verification2)

	// Get verifications for job
	results := s.JobVerifications.GetByJobId(jobId)

	require.Equal(t, 2, len(results))
	// Results should be sorted by CreatedAt descending
	assert.Equal(t, verification2.Id, results[0].Id)
	assert.Equal(t, verification1.Id, results[1].Id)
}

func TestGetByJobId_NoVerifications(t *testing.T) {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	// Get verifications when none exist
	results := s.JobVerifications.GetByJobId(jobId)

	assert.Empty(t, results)
}

func TestGetByJobId_MultipleJobs(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	job1Id := uuid.New().String()
	job2Id := uuid.New().String()

	// Create verification for job1
	verification1 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     job1Id,
		CreatedAt: time.Now(),
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	// Create verification for job2
	verification2 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     job2Id,
		CreatedAt: time.Now(),
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	s.JobVerifications.Upsert(ctx, verification1)
	s.JobVerifications.Upsert(ctx, verification2)

	// Get verifications for job1 only
	results := s.JobVerifications.GetByJobId(job1Id)

	require.Equal(t, 1, len(results))
	assert.Equal(t, verification1.Id, results[0].Id)
	assert.Equal(t, job1Id, results[0].JobId)
}

func TestGetJobVerificationStatus_AllPassed(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	// Create verification with passed metrics
	verification := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now(),
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:             "test-metric",
				Count:            2,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				Measurements: []oapi.VerificationMeasurement{
					{Status: oapi.Passed, MeasuredAt: time.Now()},
					{Status: oapi.Passed, MeasuredAt: time.Now()},
				},
			},
		},
	}

	s.JobVerifications.Upsert(ctx, verification)

	status := s.JobVerifications.GetJobVerificationStatus(jobId)
	assert.Equal(t, oapi.JobVerificationStatusPassed, status)
}

func TestGetJobVerificationStatus_Running(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	// Create verification with incomplete metrics
	verification := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now(),
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:             "test-metric",
				Count:            3,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				Measurements: []oapi.VerificationMeasurement{
					{Status: oapi.Passed, MeasuredAt: time.Now()},
				},
			},
		},
	}

	s.JobVerifications.Upsert(ctx, verification)

	status := s.JobVerifications.GetJobVerificationStatus(jobId)
	assert.Equal(t, oapi.JobVerificationStatusRunning, status)
}

func TestGetJobVerificationStatus_Failed(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	failureThreshold := 1
	// Create verification with failed metrics
	verification := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now(),
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:             "test-metric",
				Count:            3,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				FailureThreshold: &failureThreshold,
				Measurements: []oapi.VerificationMeasurement{
					{Status: oapi.Passed, MeasuredAt: time.Now()},
					{Status: oapi.Failed, MeasuredAt: time.Now()},
					{Status: oapi.Failed, MeasuredAt: time.Now()},
				},
			},
		},
	}

	s.JobVerifications.Upsert(ctx, verification)

	status := s.JobVerifications.GetJobVerificationStatus(jobId)
	assert.Equal(t, oapi.JobVerificationStatusFailed, status)
}

func TestGetJobVerificationStatus_NoVerifications(t *testing.T) {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	status := s.JobVerifications.GetJobVerificationStatus(jobId)
	assert.Equal(t, oapi.JobVerificationStatus(""), status)
}

func TestGetJobVerificationStatus_AllMustPass(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	jobId := uuid.New().String()

	// Create first verification with passed status
	verification1 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now().Add(-1 * time.Hour),
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:             "metric-1",
				Count:            1,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				Measurements: []oapi.VerificationMeasurement{
					{Status: oapi.Passed, MeasuredAt: time.Now()},
				},
			},
		},
	}

	// Create second verification that is still running
	verification2 := &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobId,
		CreatedAt: time.Now(),
		Metrics: []oapi.VerificationMetricStatus{
			{
				Name:             "metric-2",
				Count:            2,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				Measurements: []oapi.VerificationMeasurement{
					{Status: oapi.Passed, MeasuredAt: time.Now()},
				},
			},
		},
	}

	s.JobVerifications.Upsert(ctx, verification1)
	s.JobVerifications.Upsert(ctx, verification2)

	// Status should be running because second verification isn't complete
	status := s.JobVerifications.GetJobVerificationStatus(jobId)
	assert.Equal(t, oapi.JobVerificationStatusRunning, status)
}
