package indexstore

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createJobStore(t *testing.T) *Store[*oapi.Job] {
	t.Helper()
	db, err := NewDB()
	require.NoError(t, err)
	return NewStore[*oapi.Job](db, "job", func(j *oapi.Job) string { return j.Id })
}

func TestStore_First(t *testing.T) {
	store := createJobStore(t)

	// First on empty store
	result, err := store.First("id", "nonexistent")
	assert.NoError(t, err)
	assert.Nil(t, result)

	// Insert a job
	job := &oapi.Job{Id: "job-1", Status: oapi.JobStatusPending, ReleaseId: "rel-1"}
	err = store.Set(job)
	require.NoError(t, err)

	// Find by id
	result, err = store.First("id", "job-1")
	assert.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "job-1", result.Id)

	// Find by status
	result, err = store.First("status", string(oapi.JobStatusPending))
	assert.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "job-1", result.Id)
}

func TestStore_ForEach(t *testing.T) {
	store := createJobStore(t)

	// Insert multiple jobs
	for _, id := range []string{"job-1", "job-2", "job-3"} {
		err := store.Set(&oapi.Job{Id: id, Status: oapi.JobStatusPending, ReleaseId: "rel-1"})
		require.NoError(t, err)
	}

	// Iterate all
	var ids []string
	err := store.ForEach(func(j *oapi.Job) bool {
		ids = append(ids, j.Id)
		return true
	})
	assert.NoError(t, err)
	assert.Len(t, ids, 3)

	// Early termination
	var earlyIds []string
	err = store.ForEach(func(j *oapi.Job) bool {
		earlyIds = append(earlyIds, j.Id)
		return len(earlyIds) < 2 // stop after 2
	})
	assert.NoError(t, err)
	assert.Len(t, earlyIds, 2)
}

func TestStore_Count(t *testing.T) {
	store := createJobStore(t)

	// Empty
	count, err := store.Count()
	assert.NoError(t, err)
	assert.Equal(t, 0, count)

	// After inserting
	for _, id := range []string{"job-1", "job-2", "job-3"} {
		err := store.Set(&oapi.Job{Id: id, Status: oapi.JobStatusPending, ReleaseId: "rel-1"})
		require.NoError(t, err)
	}
	count, err = store.Count()
	assert.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestStore_Txn(t *testing.T) {
	store := createJobStore(t)
	txn := store.Txn()
	require.NotNil(t, txn)
	txn.Abort()
}

func TestStore_TableName(t *testing.T) {
	store := createJobStore(t)
	assert.Equal(t, "job", store.TableName())
}

func TestMemDBAdapter_Unset(t *testing.T) {
	db, err := NewDB()
	require.NoError(t, err)

	adapter := NewMemDBAdapter[*oapi.Job](db, "job")
	require.NotNil(t, adapter)

	// Insert a job
	job := &oapi.Job{Id: "job-1", Status: oapi.JobStatusPending, ReleaseId: "rel-1"}
	err = adapter.Set(t.Context(), job)
	require.NoError(t, err)

	// Verify it exists
	store := NewStore[*oapi.Job](db, "job", func(j *oapi.Job) string { return j.Id })
	result, err := store.First("id", "job-1")
	assert.NoError(t, err)
	require.NotNil(t, result)

	// Unset it
	err = adapter.Unset(t.Context(), job)
	assert.NoError(t, err)

	// Verify it's gone
	result, err = store.First("id", "job-1")
	assert.NoError(t, err)
	assert.Nil(t, result)
}

func TestMemDBAdapter_Unset_NonExistent(t *testing.T) {
	db, err := NewDB()
	require.NoError(t, err)

	adapter := NewMemDBAdapter[*oapi.Job](db, "job")
	job := &oapi.Job{Id: "nonexistent", Status: oapi.JobStatusPending, ReleaseId: "rel-1"}
	err = adapter.Unset(t.Context(), job)
	assert.NoError(t, err)
}
