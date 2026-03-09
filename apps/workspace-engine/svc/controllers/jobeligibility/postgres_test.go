package jobeligibility

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Queue
// ---------------------------------------------------------------------------

type mockQueue struct {
	enqueuedItems []reconcile.EnqueueParams
	enqueueErr    error

	enqueuedMany   [][]reconcile.EnqueueParams
	enqueueManyErr error
}

func (q *mockQueue) Enqueue(_ context.Context, params reconcile.EnqueueParams) error {
	if q.enqueueErr != nil {
		return q.enqueueErr
	}
	q.enqueuedItems = append(q.enqueuedItems, params)
	return nil
}

func (q *mockQueue) EnqueueMany(_ context.Context, params []reconcile.EnqueueParams) error {
	if q.enqueueManyErr != nil {
		return q.enqueueManyErr
	}
	q.enqueuedMany = append(q.enqueuedMany, params)
	return nil
}

func (q *mockQueue) Claim(_ context.Context, _ reconcile.ClaimParams) ([]reconcile.Item, error) {
	return nil, nil
}

func (q *mockQueue) ExtendLease(_ context.Context, _ reconcile.ExtendLeaseParams) error {
	return nil
}

func (q *mockQueue) AckSuccess(_ context.Context, _ reconcile.AckSuccessParams) (reconcile.AckSuccessResult, error) {
	return reconcile.AckSuccessResult{}, nil
}

func (q *mockQueue) Retry(_ context.Context, _ reconcile.RetryParams) error {
	return nil
}

var _ reconcile.Queue = (*mockQueue)(nil)


// ===========================================================================
// PostgresSetter — EnqueueJobDispatch (real implementation)
// ===========================================================================

func TestPostgresSetter_EnqueueJobDispatch_EnqueuesCorrectParams(t *testing.T) {
	q := &mockQueue{}
	s := &PostgresSetter{Queue: q}

	workspaceID := uuid.New().String()
	jobID := uuid.New().String()

	err := s.EnqueueJobDispatch(context.Background(), workspaceID, jobID)
	require.NoError(t, err)

	require.Len(t, q.enqueuedItems, 1)
	item := q.enqueuedItems[0]
	assert.Equal(t, workspaceID, item.WorkspaceID)
	assert.Equal(t, "job-dispatch", item.Kind)
	assert.Equal(t, "job", item.ScopeType)
	assert.Equal(t, jobID, item.ScopeID)
}

func TestPostgresSetter_EnqueueJobDispatch_PropagatesQueueError(t *testing.T) {
	q := &mockQueue{enqueueErr: fmt.Errorf("queue full")}
	s := &PostgresSetter{Queue: q}

	err := s.EnqueueJobDispatch(context.Background(), "ws-1", "job-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "queue full")
}

func TestPostgresSetter_EnqueueJobDispatch_DifferentJobsGetDifferentScopeIDs(t *testing.T) {
	q := &mockQueue{}
	s := &PostgresSetter{Queue: q}

	job1 := uuid.New().String()
	job2 := uuid.New().String()
	wsID := uuid.New().String()

	require.NoError(t, s.EnqueueJobDispatch(context.Background(), wsID, job1))
	require.NoError(t, s.EnqueueJobDispatch(context.Background(), wsID, job2))

	require.Len(t, q.enqueuedItems, 2)
	assert.Equal(t, job1, q.enqueuedItems[0].ScopeID)
	assert.Equal(t, job2, q.enqueuedItems[1].ScopeID)
	assert.NotEqual(t, q.enqueuedItems[0].ScopeID, q.enqueuedItems[1].ScopeID)
}

// ===========================================================================
// Interface conformance (compile-time checks already in source, but these
// guard against accidental removal of those assertions)
// ===========================================================================

func TestPostgresGetter_ImplementsGetter(t *testing.T) {
	var _ Getter = (*PostgresGetter)(nil)
}

func TestPostgresSetter_ImplementsSetter(t *testing.T) {
	var _ Setter = (*PostgresSetter)(nil)
}
