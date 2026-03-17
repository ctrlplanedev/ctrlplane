package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
)

const defaultTestPostgresURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

func requireDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	if os.Getenv("POSTGRES_URL") == "" {
		_ = os.Setenv("POSTGRES_URL", defaultTestPostgresURL)
	}

	ctx := context.Background()
	pool := db.GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("database not available at %s: %v", os.Getenv("POSTGRES_URL"), err)
	}

	_, err := pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS reconcile_work_scope (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    kind TEXT NOT NULL,
    scope_type TEXT NOT NULL DEFAULT '',
    scope_id TEXT NOT NULL DEFAULT '',
    event_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    priority SMALLINT NOT NULL DEFAULT 100,
    not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    claimed_by TEXT,
    claimed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, kind, scope_type, scope_id)
)`)
	if err != nil {
		t.Fatalf("failed to ensure reconcile_work_scope table: %v", err)
	}
	_, err = pool.Exec(ctx, `
CREATE INDEX IF NOT EXISTS reconcile_work_scope_claim_idx
  ON reconcile_work_scope (kind, not_before, priority, event_ts, claimed_until)`)
	if err != nil {
		t.Fatalf("failed to ensure indexes: %v", err)
	}
	_, err = pool.Exec(ctx, `TRUNCATE TABLE reconcile_work_scope RESTART IDENTITY`)
	if err != nil {
		t.Fatalf("failed to truncate reconcile_work_scope: %v", err)
	}

	return pool
}

func cleanupWorkspaceItems(t *testing.T, pool *pgxpool.Pool, workspaceID string) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
DELETE FROM reconcile_work_scope
WHERE workspace_id = $1
`, workspaceID)
	if err != nil {
		t.Logf("cleanup failed for workspace_id=%s: %v", workspaceID, err)
	}
}

// ---------------------------------------------------------------------------
// EnqueueMany tests
// ---------------------------------------------------------------------------

func TestQueue_EnqueueMany_BasicBatchAndClaim(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	scopeIDs := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}

	params := make([]reconcile.EnqueueParams, len(scopeIDs))
	for i, sid := range scopeIDs {
		params[i] = reconcile.EnqueueParams{
			WorkspaceID: workspaceID,
			Kind:        "deployment-resource-selector-eval",
			ScopeType:   "deployment",
			ScopeID:     sid,
		}
	}

	if err := queue.EnqueueMany(ctx, params); err != nil {
		t.Fatalf("EnqueueMany failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-batch",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after batch enqueue failed: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 claimed items, got %d", len(items))
	}

	claimed := map[string]bool{}
	for _, item := range items {
		claimed[item.ScopeID] = true
	}
	for _, sid := range scopeIDs {
		if !claimed[sid] {
			t.Fatalf("expected scope %s to be claimed", sid)
		}
	}
}

func TestQueue_EnqueueMany_EmptySliceIsNoOp(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	ctx := context.Background()

	if err := queue.EnqueueMany(ctx, nil); err != nil {
		t.Fatalf("EnqueueMany(nil) should be no-op, got %v", err)
	}
	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{}); err != nil {
		t.Fatalf("EnqueueMany([]) should be no-op, got %v", err)
	}
}

func TestQueue_EnqueueMany_UpsertsMergePriorityAndNotBefore(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()

	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{{
		WorkspaceID: workspaceID,
		Kind:        "eval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		Priority:    50,
		NotBefore:   time.Now().Add(10 * time.Second),
	}}); err != nil {
		t.Fatalf("first enqueue failed: %v", err)
	}

	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{{
		WorkspaceID: workspaceID,
		Kind:        "eval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		Priority:    200,
		NotBefore:   time.Now().Add(-1 * time.Second),
	}}); err != nil {
		t.Fatalf("upsert enqueue failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-upsert",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item after upsert, got %d", len(items))
	}
	if items[0].Priority != 50 {
		t.Fatalf("expected priority to stay at 50 (LEAST), got %d", items[0].Priority)
	}
}

func TestQueue_EnqueueMany_DuplicateScopeKeysInSameBatch(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()

	err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{
		{WorkspaceID: workspaceID, Kind: "eval", ScopeType: "deployment", ScopeID: scopeID},
		{WorkspaceID: workspaceID, Kind: "eval", ScopeType: "deployment", ScopeID: scopeID},
	})
	if err != nil {
		t.Fatalf("EnqueueMany with duplicate scope keys failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-dup",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 scope after dedup upsert, got %d", len(items))
	}
}

func TestQueue_EnqueueMany_ValidationErrors(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	ctx := context.Background()

	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{
		{Kind: "k"},
	}); !errors.Is(err, reconcile.ErrMissingWorkspaceID) {
		t.Fatalf("expected ErrMissingWorkspaceID, got %v", err)
	}

	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{
		{WorkspaceID: uuid.NewString()},
	}); !errors.Is(err, reconcile.ErrMissingKind) {
		t.Fatalf("expected ErrMissingKind, got %v", err)
	}

	if err := queue.EnqueueMany(ctx, []reconcile.EnqueueParams{
		{WorkspaceID: "bad-uuid", Kind: "k"},
	}); err == nil {
		t.Fatal("expected parse workspace_id error")
	}
}

func TestQueue_EnqueueMany_DatabaseError(t *testing.T) {
	if os.Getenv("POSTGRES_URL") == "" {
		_ = os.Setenv("POSTGRES_URL", defaultTestPostgresURL)
	}
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}
	queue := New(pool)
	pool.Close()

	err = queue.EnqueueMany(context.Background(), []reconcile.EnqueueParams{
		{WorkspaceID: uuid.NewString(), Kind: "k"},
	})
	if err == nil {
		t.Fatal("expected EnqueueMany db error on closed pool")
	}
}

func TestQueue_EnqueueMany_ClaimableByFilteredQueue(t *testing.T) {
	pool := requireDB(t)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	all := New(pool)
	filtered := NewForKinds(pool, "target-kind")
	ctx := context.Background()

	err := all.EnqueueMany(ctx, []reconcile.EnqueueParams{
		{WorkspaceID: workspaceID, Kind: "target-kind", ScopeType: "env", ScopeID: uuid.NewString()},
		{WorkspaceID: workspaceID, Kind: "target-kind", ScopeType: "env", ScopeID: uuid.NewString()},
		{WorkspaceID: workspaceID, Kind: "other-kind", ScopeType: "env", ScopeID: uuid.NewString()},
	})
	if err != nil {
		t.Fatalf("EnqueueMany failed: %v", err)
	}

	items, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("filtered claim failed: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items for filtered kind, got %d", len(items))
	}
	for _, item := range items {
		if item.Kind != "target-kind" {
			t.Fatalf("expected only target-kind, got %s", item.Kind)
		}
	}
}

// ---------------------------------------------------------------------------
// Enqueue (single) tests
// ---------------------------------------------------------------------------

func TestQueue_EnqueueClaimAckLifecycle(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()

	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
		NotBefore:   time.Now().Add(-1 * time.Second),
	})
	if err != nil {
		t.Fatalf("enqueue failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 claimed item, got %d", len(items))
	}
	item := items[0]
	if item.Kind != "deploymentresourceselectoreval" || item.ScopeType != "deployment" {
		t.Fatalf("unexpected item: %+v", item)
	}

	err = queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{
		ItemID:        item.ID,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if !errors.Is(err, reconcile.ErrClaimNotOwned) {
		t.Fatalf("expected ErrClaimNotOwned, got %v", err)
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           item.ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: item.UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatalf("expected deleted=true on ack, got %+v", ack)
	}

	claimedAgain, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("second claim failed: %v", err)
	}
	if len(claimedAgain) != 0 {
		t.Fatalf("expected queue to be empty, got %d", len(claimedAgain))
	}
}

func TestQueue_FilteredClaimAndRetry(t *testing.T) {
	pool := requireDB(t)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	all := New(pool)
	filtered := NewForKinds(pool, "deploymentresourceselectoreval")

	err := all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue kind A failed: %v", err)
	}
	err = all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "otherkind",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue kind B failed: %v", err)
	}

	claimedFiltered, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("filtered claim failed: %v", err)
	}
	if len(claimedFiltered) != 1 || claimedFiltered[0].Kind != "deploymentresourceselectoreval" {
		t.Fatalf("expected only filtered kind, got %+v", claimedFiltered)
	}

	err = filtered.Retry(ctx, reconcile.RetryParams{
		ItemID:       claimedFiltered[0].ID,
		WorkerID:     "worker-filtered",
		LastError:    "transient",
		RetryBackoff: 1 * time.Second,
	})
	if err != nil {
		t.Fatalf("retry failed: %v", err)
	}

	immediate, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("immediate re-claim failed: %v", err)
	}
	if len(immediate) != 0 {
		t.Fatalf("expected no immediate filtered claim after retry, got %d", len(immediate))
	}

	other, err := all.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-all",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("unfiltered claim failed: %v", err)
	}
	if len(other) != 1 || other[0].Kind != "otherkind" {
		t.Fatalf("expected to claim other kind, got %+v", other)
	}

	time.Sleep(1100 * time.Millisecond)
	afterBackoff, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after backoff failed: %v", err)
	}
	if len(afterBackoff) != 1 {
		t.Fatalf("expected 1 filtered item after backoff, got %d", len(afterBackoff))
	}
	if afterBackoff[0].AttemptCount < 1 {
		t.Fatalf("expected attempt_count to increment, got %d", afterBackoff[0].AttemptCount)
	}
	if afterBackoff[0].LastError == "" {
		t.Fatal("expected last_error to be populated after retry")
	}
}

func TestQueue_LeaseExpiry_AllowsOtherWorkerClaim(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue failed: %v", err)
	}

	claimedA, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 500 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("initial claim failed: %v", err)
	}
	if len(claimedA) != 1 {
		t.Fatalf("expected 1 initial claimed item, got %d", len(claimedA))
	}

	time.Sleep(700 * time.Millisecond)

	claimedB, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after lease expiry failed: %v", err)
	}
	if len(claimedB) != 1 {
		t.Fatalf("expected worker-b to claim item after lease expiry, got %d", len(claimedB))
	}
}

func TestQueue_ValidationAndOwnershipErrors(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	ctx := context.Background()

	if err := queue.Enqueue(
		ctx,
		reconcile.EnqueueParams{},
	); !errors.Is(err, reconcile.ErrMissingWorkspaceID) {
		t.Fatalf("expected ErrMissingWorkspaceID, got %v", err)
	}
	if err := queue.Enqueue(
		ctx,
		reconcile.EnqueueParams{WorkspaceID: uuid.NewString()},
	); !errors.Is(err, reconcile.ErrMissingKind) {
		t.Fatalf("expected ErrMissingKind, got %v", err)
	}
	if err := queue.Enqueue(
		ctx,
		reconcile.EnqueueParams{WorkspaceID: "bad-uuid", Kind: "k"},
	); err == nil {
		t.Fatal("expected parse workspace_id error")
	}

	if _, err := queue.Claim(
		ctx,
		reconcile.ClaimParams{},
	); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if _, err := queue.Claim(
		ctx,
		reconcile.ClaimParams{WorkerID: "w"},
	); !errors.Is(err, reconcile.ErrInvalidBatchSize) {
		t.Fatalf("expected ErrInvalidBatchSize, got %v", err)
	}
	if _, err := queue.Claim(
		ctx,
		reconcile.ClaimParams{WorkerID: "w", BatchSize: 1},
	); !errors.Is(err, reconcile.ErrInvalidLeaseDuration) {
		t.Fatalf("expected ErrInvalidLeaseDuration, got %v", err)
	}

	if err := queue.ExtendLease(
		ctx,
		reconcile.ExtendLeaseParams{},
	); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.ExtendLease(
		ctx,
		reconcile.ExtendLeaseParams{WorkerID: "w"},
	); !errors.Is(err, reconcile.ErrInvalidLeaseDuration) {
		t.Fatalf("expected ErrInvalidLeaseDuration, got %v", err)
	}

	if _, err := queue.AckSuccess(
		ctx,
		reconcile.AckSuccessParams{},
	); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if _, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           123456,
		WorkerID:         "w",
		ClaimedUpdatedAt: time.Now(),
	}); !errors.Is(err, reconcile.ErrClaimNotOwned) {
		t.Fatalf("expected ErrClaimNotOwned for unknown ack item, got %v", err)
	}

	if err := queue.Retry(
		ctx,
		reconcile.RetryParams{},
	); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.Retry(
		ctx,
		reconcile.RetryParams{WorkerID: "w"},
	); !errors.Is(err, reconcile.ErrInvalidRetryBackoff) {
		t.Fatalf("expected ErrInvalidRetryBackoff, got %v", err)
	}
	if err := queue.Retry(ctx, reconcile.RetryParams{
		ItemID:       987654,
		WorkerID:     "w",
		LastError:    "x",
		RetryBackoff: time.Second,
	}); !errors.Is(err, reconcile.ErrClaimNotOwned) {
		t.Fatalf("expected ErrClaimNotOwned for unknown retry item, got %v", err)
	}
}

func TestQueue_DatabaseErrorPaths(t *testing.T) {
	if os.Getenv("POSTGRES_URL") == "" {
		_ = os.Setenv("POSTGRES_URL", defaultTestPostgresURL)
	}
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}
	queue := New(pool)
	pool.Close()
	ctx := context.Background()

	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: uuid.NewString(),
		Kind:        "k",
	})
	if err == nil {
		t.Fatal("expected enqueue db error on closed pool")
	}

	if _, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "w",
		LeaseDuration: time.Second,
	}); err == nil {
		t.Fatal("expected claim db error on closed pool")
	}

	if err := queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{
		ItemID:        1,
		WorkerID:      "w",
		LeaseDuration: time.Second,
	}); err == nil {
		t.Fatal("expected extend lease db error on closed pool")
	}

	if _, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           1,
		WorkerID:         "w",
		ClaimedUpdatedAt: time.Now(),
	}); err == nil {
		t.Fatal("expected ack db error on closed pool")
	}

	if err := queue.Retry(ctx, reconcile.RetryParams{
		ItemID:       1,
		WorkerID:     "w",
		LastError:    "x",
		RetryBackoff: time.Second,
	}); err == nil {
		t.Fatal("expected retry db error on closed pool")
	}

	filtered := NewForKinds(pool, "k")
	if _, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "w",
		LeaseDuration: time.Second,
	}); err == nil {
		t.Fatal("expected filtered claim db error on closed pool")
	}
}

func TestQueue_ExtendLeaseSuccess(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: time.Second,
	})
	if err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}

	if err := queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{
		ItemID:        items[0].ID,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	}); err != nil {
		t.Fatalf("extend lease success path failed: %v", err)
	}
}

func TestQueue_ClaimAndAck(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "nopayload-kind",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue item failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim item failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one claimed scope, got %d", len(items))
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           items[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: items[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack item failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatal("expected deleted=true after ack")
	}

	next, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after ack failed: %v", err)
	}
	if len(next) != 0 {
		t.Fatalf("expected queue to be empty after ack, got %+v", next)
	}
}

func TestQueue_Retry_ReappearsAfterBackoff(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "nopayload-kind",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue item failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim item failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one claimed scope, got %d", len(items))
	}

	err = queue.Retry(ctx, reconcile.RetryParams{
		ItemID:       items[0].ID,
		WorkerID:     "worker-a",
		LastError:    "transient failure",
		RetryBackoff: 1 * time.Second,
	})
	if err != nil {
		t.Fatalf("retry item failed: %v", err)
	}

	immediate, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("immediate claim after retry failed: %v", err)
	}
	if len(immediate) != 0 {
		t.Fatalf("expected no claim during retry backoff, got %+v", immediate)
	}

	time.Sleep(1100 * time.Millisecond)
	afterBackoff, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after retry backoff failed: %v", err)
	}
	if len(afterBackoff) != 1 {
		t.Fatalf("expected scope to reappear after backoff, got %d", len(afterBackoff))
	}
	if afterBackoff[0].AttemptCount < 1 {
		t.Fatalf("expected attempt_count >= 1, got %d", afterBackoff[0].AttemptCount)
	}
	if afterBackoff[0].LastError != "transient failure" {
		t.Fatalf("expected last_error='transient failure', got %q", afterBackoff[0].LastError)
	}
}
