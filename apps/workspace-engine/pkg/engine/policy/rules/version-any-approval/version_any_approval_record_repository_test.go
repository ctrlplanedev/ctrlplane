package versionanyapproval_test

import (
	"context"
	"testing"
	"time"
	versionanyapproval "workspace-engine/pkg/engine/policy/rules/version-any-approval"

	"gotest.tools/assert"
)

type VersionAnyApprovalRecordRepositoryTestStep struct {
	createRecord *versionanyapproval.VersionAnyApprovalRecord
	updateRecord *versionanyapproval.VersionAnyApprovalRecord
	deleteRecord *versionanyapproval.VersionAnyApprovalRecord
	upsertRecord *versionanyapproval.VersionAnyApprovalRecord

	expectedRecords map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord
}

type VersionAnyApprovalRecordRepositoryTest struct {
	name  string
	steps []VersionAnyApprovalRecordRepositoryTestStep
}

type TestStepBundle struct {
	t       *testing.T
	ctx     context.Context
	repo    *versionanyapproval.VersionAnyApprovalRecordRepository
	step    VersionAnyApprovalRecordRepositoryTestStep
	message string
}

func (b *TestStepBundle) executeStep() {
	if b.step.createRecord != nil {
		err := b.repo.Create(b.ctx, b.step.createRecord)
		if err != nil {
			b.t.Fatalf("failed to create record: %v", err)
		}
	}

	if b.step.updateRecord != nil {
		err := b.repo.Update(b.ctx, b.step.updateRecord)
		if err != nil {
			b.t.Fatalf("failed to update record: %v", err)
		}
	}

	if b.step.deleteRecord != nil {
		err := b.repo.Delete(b.ctx, b.step.deleteRecord.ID)
		if err != nil {
			b.t.Fatalf("failed to delete record: %v", err)
		}
	}

	if b.step.upsertRecord != nil {
		err := b.repo.Upsert(b.ctx, b.step.upsertRecord)
		if err != nil {
			b.t.Fatalf("failed to upsert record: %v", err)
		}
	}
}

func (b *TestStepBundle) validateExpectedState() {
	for versionID, environmentRecords := range b.step.expectedRecords {
		for environmentID, records := range environmentRecords {
			actualRecords := b.repo.GetAllForVersionAndEnvironment(b.ctx, versionID, environmentID)
			assert.Equal(b.t, len(records), len(actualRecords))

			for i, expectedRecord := range records {
				actualRecord := actualRecords[i]
				assert.Equal(b.t, expectedRecord.ID, actualRecord.ID)
				assert.Equal(b.t, expectedRecord.VersionID, actualRecord.VersionID)
				assert.Equal(b.t, expectedRecord.EnvironmentID, actualRecord.EnvironmentID)
				assert.Equal(b.t, expectedRecord.UserID, actualRecord.UserID)
				assert.Equal(b.t, expectedRecord.Status, actualRecord.Status)
			}
		}
	}
}

func TestBasicCRUD(t *testing.T) {
	createRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "creates a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
						},
					},
				},
			},
		},
	}

	updateRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "updates a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
							},
						},
					},
				},
			},
			{
				updateRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
						},
					},
				},
			},
		},
	}

	deleteRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "deletes a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
						},
					},
				},
			},
			{
				deleteRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {"environment-1": {}},
				},
			},
		},
	}

	upsertRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "upserts a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				upsertRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
							},
						},
					},
				},
			},
			{
				upsertRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
						},
					},
				},
			},
		},
	}

	maintainsRecordOrderByUpdatedAt := VersionAnyApprovalRecordRepositoryTest{
		name: "maintains record order by updated at",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
					UpdatedAt:     time.Now().Add(-time.Second * 2),
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
								UpdatedAt:     time.Now().Add(-time.Second * 2),
							},
						},
					},
				},
			},
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-2",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-2",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
					UpdatedAt:     time.Now().Add(-time.Second),
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-2",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-2",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
								UpdatedAt:     time.Now().Add(-time.Second),
							},
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
								UpdatedAt:     time.Now().Add(-time.Second * 2),
							},
						},
					},
				},
			},
		},
	}

	maintainsOrderWhenRecordsAreUpdated := VersionAnyApprovalRecordRepositoryTest{
		name: "maintains order when records are updated",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
							},
						},
					},
				},
			},
			{
				createRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-2",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-2",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-2",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-2",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
							},
						},
					},
				},
			},
			{
				updateRecord: &versionanyapproval.VersionAnyApprovalRecord{
					ID:            "record-1",
					VersionID:     "version-1",
					EnvironmentID: "environment-1",
					UserID:        "user-1",
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				},
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							{
								ID:            "record-1",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-1",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
							{
								ID:            "record-2",
								VersionID:     "version-1",
								EnvironmentID: "environment-1",
								UserID:        "user-2",
								Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
							},
						},
					},
				},
			},
		},
	}

	tests := []VersionAnyApprovalRecordRepositoryTest{
		createRecord,
		updateRecord,
		deleteRecord,
		upsertRecord,
		maintainsRecordOrderByUpdatedAt,
		maintainsOrderWhenRecordsAreUpdated,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()

			for _, step := range test.steps {
				bundle := TestStepBundle{
					t:       t,
					ctx:     context.Background(),
					repo:    repo,
					step:    step,
					message: "",
				}
				bundle.executeStep()
				bundle.validateExpectedState()
			}
		})
	}
}

func TestDuplicateRecords(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	err = repo.Create(ctx, record)
	assert.ErrorContains(t, err, "record already exists")

	err = repo.Upsert(ctx, record)
	assert.NilError(t, err)

	record.Status = versionanyapproval.VersionAnyApprovalRecordStatusRejected
	err = repo.Update(ctx, record)
	assert.NilError(t, err)
}

func TestUpdateNonExistingRecord(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	record2 := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-2",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
	}

	err = repo.Update(ctx, record2)
	assert.ErrorContains(t, err, "record not found")
}

func TestUpdateRecordWithReadonlyIds(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	updateRecord := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-2",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err = repo.Update(ctx, updateRecord)
	assert.ErrorContains(t, err, "version ID mismatch")
	err = repo.Upsert(ctx, updateRecord)
	assert.ErrorContains(t, err, "version ID mismatch")

	updateRecord.VersionID = "version-1"
	updateRecord.EnvironmentID = "environment-2"
	err = repo.Update(ctx, updateRecord)
	assert.ErrorContains(t, err, "environment ID mismatch")
	err = repo.Upsert(ctx, updateRecord)
	assert.ErrorContains(t, err, "environment ID mismatch")

	updateRecord.EnvironmentID = "environment-1"
	updateRecord.UserID = "user-2"
	err = repo.Update(ctx, updateRecord)
	assert.ErrorContains(t, err, "user ID mismatch")
	err = repo.Upsert(ctx, updateRecord)
	assert.ErrorContains(t, err, "user ID mismatch")

	updateRecord.UserID = "user-1"
	err = repo.Update(ctx, updateRecord)
	assert.NilError(t, err)
}

func TestNilHandling(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	err := repo.Create(ctx, nil)
	assert.ErrorContains(t, err, "record is nil")

	err = repo.Update(ctx, nil)
	assert.ErrorContains(t, err, "record is nil")

	err = repo.Delete(ctx, "")
	assert.NilError(t, err)

	err = repo.Upsert(ctx, nil)
	assert.ErrorContains(t, err, "record is nil")
}

func TestGlobalIDUniqueness(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	// Create first record in version-1/environment-1
	record1 := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err := repo.Create(ctx, record1)
	assert.NilError(t, err)

	// Attempt to create a record with the same ID in a different version/environment bucket
	record2 := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",      // Same ID as record1
		VersionID:     "version-2",     // Different version
		EnvironmentID: "environment-2", // Different environment
		UserID:        "user-2",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
	}

	err = repo.Create(ctx, record2)
	assert.ErrorContains(t, err, "record already exists")

	// Verify the first record still exists and is unchanged
	existingRecord := repo.Get(ctx, "record-1")
	assert.Assert(t, existingRecord != nil)
	assert.Equal(t, existingRecord.ID, "record-1")
	assert.Equal(t, existingRecord.VersionID, "version-1")
	assert.Equal(t, existingRecord.EnvironmentID, "environment-1")
	assert.Equal(t, existingRecord.UserID, "user-1")
	assert.Equal(t, existingRecord.Status, versionanyapproval.VersionAnyApprovalRecordStatusApproved)

	// Verify the second record was not created
	nonExistentRecord := repo.Get(ctx, "record-2")
	assert.Assert(t, nonExistentRecord == nil)
}

func TestUserUniquenessForEnvAndVersion(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record1 := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-1",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	}

	err := repo.Create(ctx, record1)
	assert.NilError(t, err)

	record2 := &versionanyapproval.VersionAnyApprovalRecord{
		ID:            "record-2",
		VersionID:     "version-1",
		EnvironmentID: "environment-1",
		UserID:        "user-1",
		Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
	}

	err = repo.Create(ctx, record2)
	assert.ErrorContains(t, err, "record already exists for user")

	err = repo.Upsert(ctx, record2)
	assert.ErrorContains(t, err, "record already exists for user")

	record2.UserID = "user-2"
	err = repo.Upsert(ctx, record2)
	assert.NilError(t, err)
}
