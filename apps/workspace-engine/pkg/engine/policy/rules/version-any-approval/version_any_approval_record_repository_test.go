package versionanyapproval_test

import (
	"context"
	"fmt"
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
		err := b.repo.Delete(b.ctx, b.step.deleteRecord.GetID())
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

	time.Sleep(1 * time.Millisecond)
}

func (b *TestStepBundle) validateExpectedState() {
	for versionID, environmentRecords := range b.step.expectedRecords {
		for environmentID, records := range environmentRecords {
			actualRecords := b.repo.GetAllForVersionAndEnvironment(b.ctx, versionID, environmentID)
			assert.Equal(b.t, len(records), len(actualRecords))

			for _, actualRecord := range actualRecords {
				fmt.Println(actualRecord.GetID(), actualRecord.GetUpdatedAt())
			}

			for i, expectedRecord := range records {
				actualRecord := actualRecords[i]
				assert.Equal(b.t, expectedRecord.GetID(), actualRecord.GetID())
				assert.Equal(b.t, expectedRecord.GetVersionID(), actualRecord.GetVersionID())
				assert.Equal(b.t, expectedRecord.GetEnvironmentID(), actualRecord.GetEnvironmentID())
				assert.Equal(b.t, expectedRecord.GetUserID(), actualRecord.GetUserID())
				assert.Equal(b.t, expectedRecord.GetStatus(), actualRecord.GetStatus())
			}
		}
	}
}

func TestBasicCRUD(t *testing.T) {
	createRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "creates a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
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
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
								Build(),
						},
					},
				},
			},
			{
				updateRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
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
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
						},
					},
				},
			},
			{
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-2").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-2").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-2").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-2").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
						},
					},
				},
			},
			{
				deleteRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-2").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-2").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
						},
					},
				},
			},
		},
	}

	upsertRecord := VersionAnyApprovalRecordRepositoryTest{
		name: "upserts a record",
		steps: []VersionAnyApprovalRecordRepositoryTestStep{
			{
				upsertRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
								Build(),
						},
					},
				},
			},
			{
				upsertRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
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
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
						},
					},
				},
			},
			{
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-2").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-2").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-2").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-2").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
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
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
								Build(),
						},
					},
				},
			},
			{
				createRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-2").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-2").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-2").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-2").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
								Build(),
						},
					},
				},
			},
			{
				updateRecord: versionanyapproval.NewVersionAnyApprovalRecordBuilder().
					WithID("record-1").
					WithVersionID("version-1").
					WithEnvironmentID("environment-1").
					WithUserID("user-1").
					WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
					Build(),
				expectedRecords: map[string]map[string][]*versionanyapproval.VersionAnyApprovalRecord{
					"version-1": {
						"environment-1": {
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-1").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-1").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
							versionanyapproval.NewVersionAnyApprovalRecordBuilder().
								WithID("record-2").
								WithVersionID("version-1").
								WithEnvironmentID("environment-1").
								WithUserID("user-2").
								WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
								Build(),
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

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	err = repo.Create(ctx, record)
	assert.ErrorContains(t, err, "record already exists")

	err = repo.Upsert(ctx, record)
	assert.NilError(t, err)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Update(ctx, record2)
	assert.NilError(t, err)
}

func TestUpdateNonExistingRecord(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	// record := &versionanyapproval.VersionAnyApprovalRecord{
	// 	ID:            "record-1",
	// 	VersionID:     "version-1",
	// 	EnvironmentID: "environment-1",
	// 	UserID:        "user-1",
	// 	Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
	// }

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Update(ctx, record2)
	assert.ErrorContains(t, err, "record not found")
}

func TestUpdateRecordWithReadonlyIds(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	updateRecord := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-2").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Update(ctx, updateRecord)
	assert.ErrorContains(t, err, "version ID mismatch")
	err = repo.Upsert(ctx, updateRecord)
	assert.ErrorContains(t, err, "version ID mismatch")

	updateRecord2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-2").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Update(ctx, updateRecord2)
	assert.ErrorContains(t, err, "environment ID mismatch")
	err = repo.Upsert(ctx, updateRecord2)
	assert.ErrorContains(t, err, "environment ID mismatch")

	updateRecord3 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Update(ctx, updateRecord3)
	assert.ErrorContains(t, err, "user ID mismatch")
	err = repo.Upsert(ctx, updateRecord3)
	assert.ErrorContains(t, err, "user ID mismatch")

	updateRecord4 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()
	err = repo.Update(ctx, updateRecord4)
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
	record1 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record1)
	assert.NilError(t, err)

	// Attempt to create a record with the same ID in a different version/environment bucket
	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-2").
		WithEnvironmentID("environment-2").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Create(ctx, record2)
	assert.ErrorContains(t, err, "record already exists")

	// Verify the first record still exists and is unchanged
	existingRecord := repo.Get(ctx, "record-1")
	assert.Assert(t, existingRecord != nil)
	assert.Equal(t, existingRecord.GetID(), "record-1")
	assert.Equal(t, existingRecord.GetVersionID(), "version-1")
	assert.Equal(t, existingRecord.GetEnvironmentID(), "environment-1")
	assert.Equal(t, existingRecord.GetUserID(), "user-1")
	assert.Equal(t, existingRecord.GetStatus(), versionanyapproval.ApprovalRecordStatusApproved)

	// verify that the second record was not created
	allRecords := repo.GetAll(ctx)
	assert.Equal(t, len(allRecords), 1)
	assert.Equal(t, allRecords[0].GetID(), "record-1")
	assert.Equal(t, allRecords[0].GetVersionID(), "version-1")
	assert.Equal(t, allRecords[0].GetEnvironmentID(), "environment-1")
	assert.Equal(t, allRecords[0].GetUserID(), "user-1")
	assert.Equal(t, allRecords[0].GetStatus(), versionanyapproval.ApprovalRecordStatusApproved)
}

func TestUserUniquenessForEnvAndVersion(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record1 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record1)
	assert.NilError(t, err)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Create(ctx, record2)
	assert.ErrorContains(t, err, "record already exists for user")

	err = repo.Upsert(ctx, record2)
	assert.ErrorContains(t, err, "record already exists for user")

	record3 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Upsert(ctx, record3)
	assert.NilError(t, err)
}

func TestExists(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	assert.Equal(t, repo.Exists(ctx, "record-1"), true)
	assert.Equal(t, repo.Exists(ctx, "record-2"), false)
}

func TestGetAll(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-2").
		WithEnvironmentID("environment-2").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Create(ctx, record2)
	assert.NilError(t, err)

	records := repo.GetAll(ctx)
	assert.Equal(t, len(records), 2)
	assert.Equal(t, records[0].GetID(), "record-2")
	assert.Equal(t, records[1].GetID(), "record-1")
}

func TestCreateWithReason(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	reason := "reason-1"
	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		WithReason(&reason).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	actualRecord := repo.Get(ctx, "record-1")
	assert.Equal(t, *actualRecord.GetReason(), reason)

	recordWithNilReason := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Create(ctx, recordWithNilReason)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-2")
	assert.Equal(t, actualRecord.GetReason(), (*string)(nil))
}

func TestCreateInvalidRecord(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	recordWithEmptyVersionID := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, recordWithEmptyVersionID)
	assert.ErrorContains(t, err, "version ID is empty")

	recordWithEmptyEnvironmentID := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Create(ctx, recordWithEmptyEnvironmentID)
	assert.ErrorContains(t, err, "environment ID is empty")

	recordWithEmptyUserID := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Create(ctx, recordWithEmptyUserID)
	assert.ErrorContains(t, err, "user ID is empty")

	recordWithEmptyStatus := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		Build()

	recordWithEmptyID := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Create(ctx, recordWithEmptyID)
	assert.ErrorContains(t, err, "record ID is empty")

	err = repo.Create(ctx, recordWithEmptyStatus)
	assert.ErrorContains(t, err, "status is empty")

	recordWithApprovedAtSetForNonApprovedStatus := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		WithApprovedAt(time.Now().UTC()).
		Build()

	err = repo.Create(ctx, recordWithApprovedAtSetForNonApprovedStatus)
	assert.ErrorContains(t, err, "approvedAt is set for a non-approved record")

	err = repo.Upsert(ctx, recordWithApprovedAtSetForNonApprovedStatus)
	assert.ErrorContains(t, err, "approvedAt is set for a non-approved record")
}

func TestCreateWithTimestamps(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	now := time.Now().UTC()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		WithCreatedAt(now).
		WithUpdatedAt(now).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	actualRecord := repo.Get(ctx, "record-1")
	assert.Equal(t, actualRecord.GetCreatedAt(), now)
	assert.Equal(t, actualRecord.GetUpdatedAt(), now)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		WithCreatedAt(now).
		WithUpdatedAt(now).
		Build()

	err = repo.Upsert(ctx, record2)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-2")
	assert.Equal(t, actualRecord.GetCreatedAt(), now)
	assert.Equal(t, actualRecord.GetUpdatedAt(), now)
}

func TestInsertsTimestampsIfNotProvided(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	actualRecord := repo.Get(ctx, "record-1")
	assert.Assert(t, actualRecord.GetCreatedAt() != time.Time{})
	assert.Assert(t, actualRecord.GetUpdatedAt() != time.Time{})

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Upsert(ctx, record2)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-2")
	assert.Assert(t, actualRecord.GetCreatedAt() != time.Time{})
	assert.Assert(t, actualRecord.GetUpdatedAt() != time.Time{})
}

func TestAutopopulatesApprovedAtIfBuildWithApprovedStatus(t *testing.T) {
	repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
	ctx := context.Background()

	record := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-1").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-1").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err := repo.Create(ctx, record)
	assert.NilError(t, err)

	actualRecord := repo.Get(ctx, "record-1")
	assert.Assert(t, actualRecord.GetApprovedAt() != nil)

	record2 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-2").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-2").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Upsert(ctx, record2)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-2")
	assert.Assert(t, actualRecord.GetApprovedAt() != nil)

	record3 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-3").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-3").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Upsert(ctx, record3)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-3")
	assert.Assert(t, actualRecord.GetApprovedAt() == nil)

	record3Updated := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-3").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-3").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Upsert(ctx, record3Updated)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-3")
	assert.Assert(t, actualRecord.GetApprovedAt() != nil)

	record4 := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-4").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-4").
		WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
		Build()

	err = repo.Upsert(ctx, record4)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-4")
	assert.Assert(t, actualRecord.GetApprovedAt() == nil)

	record4Upserted := versionanyapproval.NewVersionAnyApprovalRecordBuilder().
		WithID("record-4").
		WithVersionID("version-1").
		WithEnvironmentID("environment-1").
		WithUserID("user-4").
		WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
		Build()

	err = repo.Upsert(ctx, record4Upserted)
	assert.NilError(t, err)

	actualRecord = repo.Get(ctx, "record-4")
	assert.Assert(t, actualRecord.GetApprovedAt() != nil)
}
