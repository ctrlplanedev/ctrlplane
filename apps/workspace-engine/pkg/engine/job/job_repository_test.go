package job

import (
	"context"
	"reflect"
	"testing"
	"time"
	"workspace-engine/pkg/model/job"

	"gotest.tools/assert"
)

type JobRepositoryTestStep struct {
	createJob *job.Job
	updateJob *job.Job
	removeJob *job.Job

	expectedJobs []job.Job
}

type JobRepositoryTest struct {
	name  string
	steps []JobRepositoryTestStep
}

func assertStrPtrsEqual(t *testing.T, expected, actual *string) {
	if expected == nil {
		assert.Equal(t, actual, (*string)(nil))
		return
	}

	if actual == nil {
		t.Errorf("expected string pointer to be nil, but got %v", actual)
		return
	}

	assert.Equal(t, *expected, *actual)
}

func TestJobRepository_BasicCRUD(t *testing.T) {
	now := time.Now().UTC()
	createJob := JobRepositoryTest{
		name: "creates a job",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", CreatedAt: now, UpdatedAt: now},
				expectedJobs: []job.Job{{ID: "1", CreatedAt: now, UpdatedAt: now}},
			},
		},
	}

	updateJob := JobRepositoryTest{
		name: "updates a job",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", Status: job.JobStatusPending},
				expectedJobs: []job.Job{{ID: "1", Status: job.JobStatusPending}},
			},
			{
				updateJob:    &job.Job{ID: "1", Status: job.JobStatusInProgress},
				expectedJobs: []job.Job{{ID: "1", Status: job.JobStatusInProgress}},
			},
		},
	}

	updateJobJobAgentID := JobRepositoryTest{
		name: "updates a job's job agent id",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", JobAgentID: &[]string{"1"}[0]},
				expectedJobs: []job.Job{{ID: "1", JobAgentID: &[]string{"1"}[0]}},
			},
			{
				updateJob:    &job.Job{ID: "1", JobAgentID: &[]string{"2"}[0]},
				expectedJobs: []job.Job{{ID: "1", JobAgentID: &[]string{"2"}[0]}},
			},
		},
	}

	updateJobJobAgentConfig := JobRepositoryTest{
		name: "updates a job's job agent config",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", JobAgentConfig: map[string]any{"key": "value"}},
				expectedJobs: []job.Job{{ID: "1", JobAgentConfig: map[string]any{"key": "value"}}},
			},
			{
				updateJob:    &job.Job{ID: "1", JobAgentConfig: map[string]any{"key": "new_value"}},
				expectedJobs: []job.Job{{ID: "1", JobAgentConfig: map[string]any{"key": "new_value"}}},
			},
		},
	}

	updateJobExternalID := JobRepositoryTest{
		name: "updates a job's external id",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", ExternalID: &[]string{"1"}[0]},
				expectedJobs: []job.Job{{ID: "1", ExternalID: &[]string{"1"}[0]}},
			},
			{
				updateJob:    &job.Job{ID: "1", ExternalID: &[]string{"2"}[0]},
				expectedJobs: []job.Job{{ID: "1", ExternalID: &[]string{"2"}[0]}},
			},
		},
	}

	updateJobStatus := JobRepositoryTest{
		name: "updates a job's status",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", Status: job.JobStatusPending},
				expectedJobs: []job.Job{{ID: "1", Status: job.JobStatusPending}},
			},
			{
				updateJob:    &job.Job{ID: "1", Status: job.JobStatusInProgress},
				expectedJobs: []job.Job{{ID: "1", Status: job.JobStatusInProgress}},
			},
		},
	}

	updateJobReason := JobRepositoryTest{
		name: "updates a job's reason",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", Reason: job.JobReasonEnvPolicyOverride},
				expectedJobs: []job.Job{{ID: "1", Reason: job.JobReasonEnvPolicyOverride}},
			},
			{
				updateJob:    &job.Job{ID: "1", Reason: job.JobReasonConfigPolicyOverride},
				expectedJobs: []job.Job{{ID: "1", Reason: job.JobReasonConfigPolicyOverride}},
			},
		},
	}

	updateJobMessage := JobRepositoryTest{
		name: "updates a job's message",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", Message: &[]string{"1"}[0]},
				expectedJobs: []job.Job{{ID: "1", Message: &[]string{"1"}[0]}},
			},
			{
				updateJob:    &job.Job{ID: "1", Message: &[]string{"2"}[0]},
				expectedJobs: []job.Job{{ID: "1", Message: &[]string{"2"}[0]}},
			},
		},
	}

	updateJobStartedAt := JobRepositoryTest{
		name: "updates a job's started at",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", StartedAt: now.Add(-time.Second * 10)},
				expectedJobs: []job.Job{{ID: "1", StartedAt: now.Add(-time.Second * 10)}},
			},
			{
				updateJob:    &job.Job{ID: "1", StartedAt: now.Add(-time.Second * 5)},
				expectedJobs: []job.Job{{ID: "1", StartedAt: now.Add(-time.Second * 5)}},
			},
		},
	}

	updateJobCompletedAt := JobRepositoryTest{
		name: "updates a job's completed at",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1", CompletedAt: now.Add(-time.Second * 10)},
				expectedJobs: []job.Job{{ID: "1", CompletedAt: now.Add(-time.Second * 10)}},
			},
			{
				updateJob:    &job.Job{ID: "1", CompletedAt: now.Add(-time.Second * 5)},
				expectedJobs: []job.Job{{ID: "1", CompletedAt: now.Add(-time.Second * 5)}},
			},
		},
	}

	removeJob := JobRepositoryTest{
		name: "removes a job",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1"},
				expectedJobs: []job.Job{{ID: "1"}},
			},
			{
				removeJob:    &job.Job{ID: "1"},
				expectedJobs: []job.Job{},
			},
		},
	}

	sorting := JobRepositoryTest{
		name: "sorts jobs by updated at",
		steps: []JobRepositoryTestStep{
			{
				createJob:    &job.Job{ID: "1"},
				expectedJobs: []job.Job{{ID: "1"}},
			},
			{
				createJob:    &job.Job{ID: "2"},
				expectedJobs: []job.Job{{ID: "2"}, {ID: "1"}},
			},
			{
				createJob:    &job.Job{ID: "3"},
				expectedJobs: []job.Job{{ID: "3"}, {ID: "2"}, {ID: "1"}},
			},
			{
				updateJob:    &job.Job{ID: "1"},
				expectedJobs: []job.Job{{ID: "1"}, {ID: "3"}, {ID: "2"}},
			},
			{
				updateJob:    &job.Job{ID: "2"},
				expectedJobs: []job.Job{{ID: "2"}, {ID: "1"}, {ID: "3"}},
			},
			{
				updateJob:    &job.Job{ID: "3"},
				expectedJobs: []job.Job{{ID: "3"}, {ID: "2"}, {ID: "1"}},
			},
		},
	}

	tests := []JobRepositoryTest{
		createJob,
		updateJob,
		updateJobJobAgentID,
		updateJobJobAgentConfig,
		updateJobExternalID,
		updateJobStatus,
		updateJobReason,
		updateJobMessage,
		updateJobStartedAt,
		updateJobCompletedAt,
		removeJob,
		sorting,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := NewJobRepository()
			ctx := context.Background()

			for _, step := range test.steps {
				if step.createJob != nil {
					err := repository.Create(ctx, step.createJob)
					assert.NilError(t, err)
				}

				if step.updateJob != nil {
					err := repository.Update(ctx, step.updateJob)
					assert.NilError(t, err)
				}

				if step.removeJob != nil {
					err := repository.Delete(ctx, step.removeJob.GetID())
					assert.NilError(t, err)
					assert.Assert(t, !repository.Exists(ctx, step.removeJob.GetID()), "job should not exist")
				}

				actualJobs := repository.GetAll(ctx)
				assert.Equal(t, len(actualJobs), len(step.expectedJobs))

				for i, expectedJob := range step.expectedJobs {
					assert.Assert(t, repository.Exists(ctx, expectedJob.GetID()), "job should exist")
					actualJob := actualJobs[i]

					assert.Equal(t, expectedJob.GetID(), actualJob.GetID())

					assertStrPtrsEqual(t, expectedJob.GetJobAgentID(), actualJob.GetJobAgentID())
					assert.Assert(t, reflect.DeepEqual(expectedJob.GetJobAgentConfig(), actualJob.GetJobAgentConfig()), "job agent configs should be equal")

					assertStrPtrsEqual(t, expectedJob.GetExternalID(), actualJob.GetExternalID())

					assert.Equal(t, expectedJob.GetStatus(), actualJob.GetStatus())
					assert.Equal(t, expectedJob.GetReason(), actualJob.GetReason())
					assertStrPtrsEqual(t, expectedJob.GetMessage(), actualJob.GetMessage())

					assert.Equal(t, expectedJob.GetStartedAt(), actualJob.GetStartedAt())
					assert.Equal(t, expectedJob.GetCompletedAt(), actualJob.GetCompletedAt())
				}
			}
		})
	}
}

func TestJobRepository_GetAll(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	repository.Create(ctx, &job.Job{ID: "1"})
	repository.Create(ctx, &job.Job{ID: "2"})
	repository.Create(ctx, &job.Job{ID: "3"})

	jobs := repository.GetAll(ctx)
	assert.Equal(t, len(jobs), 3)
}

func TestJobRepository_Timestamps(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	err := repository.Create(ctx, &job.Job{ID: "1"})
	assert.NilError(t, err)

	createdJob := repository.Get(ctx, "1")
	assert.Equal(t, createdJob.GetCreatedAt().IsZero(), false)
	assert.Equal(t, createdJob.GetUpdatedAt().IsZero(), false)

	err = repository.Update(ctx, &job.Job{ID: "1"})
	assert.NilError(t, err)

	updatedJob := repository.Get(ctx, "1")
	assert.Equal(t, updatedJob.GetUpdatedAt().IsZero(), false)
	assert.Equal(t, updatedJob.GetUpdatedAt().After(createdJob.GetUpdatedAt()), true)
	assert.Equal(t, updatedJob.GetUpdatedAt().After(createdJob.GetUpdatedAt()), true)

	err = repository.Update(ctx, &job.Job{ID: "1", UpdatedAt: updatedJob.GetUpdatedAt()})
	assert.NilError(t, err)

	updatedJob2 := repository.Get(ctx, "1")
	assert.Equal(t, updatedJob2.GetUpdatedAt().After(updatedJob.GetUpdatedAt()), true)

	now := time.Now().UTC()
	err = repository.Create(ctx, &job.Job{ID: "2", CreatedAt: now, UpdatedAt: now})
	assert.NilError(t, err)

	createdJob2 := repository.Get(ctx, "2")
	assert.Equal(t, createdJob2.GetCreatedAt(), now)
	assert.Equal(t, createdJob2.GetUpdatedAt(), now)
}

func TestJobRepository_NilJobThrowsError(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	err := repository.Create(ctx, nil)
	assert.Error(t, err, "job is nil")

	err = repository.Update(ctx, nil)
	assert.Error(t, err, "job is nil")
}

func TestJobRepository_CreatingDuplicateJobThrowsError(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	err := repository.Create(ctx, &job.Job{ID: "1"})
	assert.NilError(t, err)

	err = repository.Create(ctx, &job.Job{ID: "1"})
	assert.Error(t, err, "job already exists")
}

func TestJobRepository_UpdatingNonExistentJobThrowsError(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	err := repository.Update(ctx, &job.Job{ID: "1"})
	assert.Error(t, err, "job does not exist")
}

func TestJobRepository_DeletingNonExistentJobThrowsError(t *testing.T) {
	repository := NewJobRepository()
	ctx := context.Background()

	err := repository.Delete(ctx, "1")
	assert.Error(t, err, "job does not exist")
}
