package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
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
    claimed_by TEXT,
    claimed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, kind, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS reconcile_work_payload (
    id BIGSERIAL PRIMARY KEY,
    scope_ref BIGINT NOT NULL REFERENCES reconcile_work_scope(id) ON DELETE CASCADE,
    payload_type TEXT NOT NULL DEFAULT '',
    payload_key TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scope_ref, payload_type, payload_key)
)`)
	if err != nil {
		t.Fatalf("failed to ensure reconcile_work_item table: %v", err)
	}
	_, err = pool.Exec(ctx, `
CREATE INDEX IF NOT EXISTS reconcile_work_scope_claim_idx
  ON reconcile_work_scope (kind, not_before, priority, event_ts, claimed_until);

CREATE INDEX IF NOT EXISTS reconcile_work_payload_scope_ref_idx
  ON reconcile_work_payload (scope_ref);
`)
	if err != nil {
		t.Fatalf("failed to ensure indexes for reconcile_work tables: %v", err)
	}
	_, err = pool.Exec(ctx, `
TRUNCATE TABLE reconcile_work_payload, reconcile_work_scope RESTART IDENTITY;
`)
	if err != nil {
		t.Fatalf("failed to truncate reconcile_work tables: %v", err)
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

	// Wrong owner cannot extend lease.
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
		PayloadType: "selector_eval",
		PayloadKey:  "retry-a",
		Payload:     json.RawMessage(`{"selector":"retry-a"}`),
	})
	if err != nil {
		t.Fatalf("enqueue kind A failed: %v", err)
	}
	err = all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "otherkind",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
		PayloadType: "selector_eval",
		PayloadKey:  "retry-b",
		Payload:     json.RawMessage(`{"selector":"retry-b"}`),
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

	// Retry delays visibility and increments attempt count.
	err = filtered.Retry(ctx, reconcile.RetryParams{
		ItemID:       claimedFiltered[0].ID,
		WorkerID:     "worker-filtered",
		LastError:    "transient",
		RetryBackoff: 1 * time.Second,
	})
	if err != nil {
		t.Fatalf("retry failed: %v", err)
	}

	// Immediately claiming filtered item should return none due to not_before.
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

	// Unfiltered queue should still be able to claim the other kind.
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

func TestQueue_ClaimAggregatesPayloadsByScope(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	kind := "deploymentresourceselectoreval"
	scopeType := "deployment"

	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-a",
		Payload:     json.RawMessage(`{"selector":"a"}`),
		NotBefore:   time.Now().Add(-1 * time.Second),
	})
	if err != nil {
		t.Fatalf("enqueue payload A failed: %v", err)
	}

	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-b",
		Payload:     json.RawMessage(`{"selector":"b"}`),
		NotBefore:   time.Now().Add(-1 * time.Second),
	})
	if err != nil {
		t.Fatalf("enqueue payload B failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-aggregate",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 claimed scope item, got %d", len(items))
	}
	if len(items[0].Payloads) != 2 {
		t.Fatalf("expected 2 payloads on claimed scope item, got %d", len(items[0].Payloads))
	}

	keys := map[string]bool{}
	for _, payload := range items[0].Payloads {
		keys[payload.Key] = true
	}
	if !keys["payload-a"] || !keys["payload-b"] {
		t.Fatalf("expected payload-a and payload-b keys, got %+v", keys)
	}

	noneWhileClaimed, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-aggregate-2",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim while leased failed: %v", err)
	}
	if len(noneWhileClaimed) != 0 {
		t.Fatalf("expected zero items while same scope is leased, got %d", len(noneWhileClaimed))
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           items[0].ID,
		WorkerID:         "worker-aggregate",
		ClaimedUpdatedAt: items[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatalf("expected aggregated scope delete on ack, got %+v", ack)
	}

	afterAck, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-aggregate",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after ack failed: %v", err)
	}
	if len(afterAck) != 0 {
		t.Fatalf("expected no remaining scope items after ack delete, got %d", len(afterAck))
	}
}

func TestQueue_EnqueuePayloadWhileClaimed_NotVisibleToOtherWorkers(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	kind := "deploymentresourceselectoreval"
	scopeType := "deployment"

	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-a",
		Payload:     json.RawMessage(`{"selector":"a"}`),
	})
	if err != nil {
		t.Fatalf("enqueue payload A failed: %v", err)
	}

	claimedByA, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-a claim failed: %v", err)
	}
	if len(claimedByA) != 1 {
		t.Fatalf("expected worker-a to claim one scope, got %d", len(claimedByA))
	}

	// Add more payloads for the same scope while worker-a still owns the lease.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-b",
		Payload:     json.RawMessage(`{"selector":"b"}`),
	})
	if err != nil {
		t.Fatalf("enqueue payload B during active claim failed: %v", err)
	}

	claimedByB, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-b claim while leased failed: %v", err)
	}
	if len(claimedByB) != 0 {
		t.Fatalf("expected worker-b to get no scope while worker-a lease active, got %+v", claimedByB)
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           claimedByA[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: claimedByA[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("worker-a ack failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatalf("expected at least original claimed rows to be deleted")
	}

	claimedAfterRelease, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-b claim after release failed: %v", err)
	}
	if len(claimedAfterRelease) != 1 {
		t.Fatalf("expected worker-b to claim the scope after release, got %d", len(claimedAfterRelease))
	}
	if len(claimedAfterRelease[0].Payloads) != 1 {
		t.Fatalf("expected only newly enqueued payload to remain, got %d", len(claimedAfterRelease[0].Payloads))
	}
	if claimedAfterRelease[0].Payloads[0].Key != "payload-b" {
		t.Fatalf("expected remaining payload key payload-b, got %s", claimedAfterRelease[0].Payloads[0].Key)
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

func TestQueue_FilteredByKind_WithAggregatedPayloads(t *testing.T) {
	pool := requireDB(t)
	all := New(pool)
	filtered := NewForKinds(pool, "deploymentresourceselectoreval")
	workspaceID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	scopeID := uuid.NewString()
	err := all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "kind-a-1",
		Payload:     json.RawMessage(`{"selector":"a1"}`),
	})
	if err != nil {
		t.Fatalf("enqueue filtered payload 1 failed: %v", err)
	}
	err = all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "kind-a-2",
		Payload:     json.RawMessage(`{"selector":"a2"}`),
	})
	if err != nil {
		t.Fatalf("enqueue filtered payload 2 failed: %v", err)
	}
	err = all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "otherkind",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue other kind failed: %v", err)
	}

	filteredClaim, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("filtered claim failed: %v", err)
	}
	if len(filteredClaim) != 1 {
		t.Fatalf("expected one filtered scope, got %d", len(filteredClaim))
	}
	if filteredClaim[0].Kind != "deploymentresourceselectoreval" {
		t.Fatalf("expected filtered kind only, got %s", filteredClaim[0].Kind)
	}
	if len(filteredClaim[0].Payloads) != 2 {
		t.Fatalf("expected filtered scope to aggregate 2 payloads, got %d", len(filteredClaim[0].Payloads))
	}

	otherClaim, err := all.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-all",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("unfiltered claim failed: %v", err)
	}
	if len(otherClaim) != 1 || otherClaim[0].Kind != "otherkind" {
		t.Fatalf("expected only otherkind to remain claimable, got %+v", otherClaim)
	}
}

func TestQueue_ReenqueueSamePayloadAndSingleFlightPerScope(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "stable-payload",
		Payload:     json.RawMessage(`{"version":1}`),
	})
	if err != nil {
		t.Fatalf("initial enqueue failed: %v", err)
	}

	// Same payload identity should upsert, not create another payload entry.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "stable-payload",
		Payload:     json.RawMessage(`{"version":2}`),
	})
	if err != nil {
		t.Fatalf("re-enqueue same payload identity failed: %v", err)
	}

	claimedA, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-a claim failed: %v", err)
	}
	if len(claimedA) != 1 {
		t.Fatalf("expected worker-a to claim one scope, got %d", len(claimedA))
	}
	if len(claimedA[0].Payloads) != 1 {
		t.Fatalf("expected one payload after upsert, got %d", len(claimedA[0].Payloads))
	}

	claimedB, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-b claim failed: %v", err)
	}
	if len(claimedB) != 0 {
		t.Fatalf("expected no concurrent claim for same scope key, got %+v", claimedB)
	}
}

func TestQueue_SingleFlightPerScope_AckProcessedRows_ContinueWithNewPayloads(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	otherScopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	kind := "deploymentresourceselectoreval"
	scopeType := "deployment"

	// Initial scope has two payloads that should be processed together.
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-a",
		Payload:     json.RawMessage(`{"selector":"a"}`),
	})
	if err != nil {
		t.Fatalf("enqueue payload-a failed: %v", err)
	}
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-b",
		Payload:     json.RawMessage(`{"selector":"b"}`),
	})
	if err != nil {
		t.Fatalf("enqueue payload-b failed: %v", err)
	}

	claimedA, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-a claim failed: %v", err)
	}
	if len(claimedA) != 1 {
		t.Fatalf("expected worker-a to claim one scope, got %d", len(claimedA))
	}
	if claimedA[0].ScopeID != scopeID {
		t.Fatalf("expected worker-a to claim target scope %s, got %s", scopeID, claimedA[0].ScopeID)
	}
	if len(claimedA[0].Payloads) != 2 {
		t.Fatalf("expected worker-a to get both payloads for scope, got %d", len(claimedA[0].Payloads))
	}

	// New payloads can be added while claimed, but must not be claimable until release.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "payload-c",
		Payload:     json.RawMessage(`{"selector":"c"}`),
		NotBefore:   time.Now().Add(-1 * time.Second),
	})
	if err != nil {
		t.Fatalf("enqueue payload-c during active claim failed: %v", err)
	}

	// Another scope ensures queue can keep progressing while this scope is leased.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     otherScopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "other-scope",
		Payload:     json.RawMessage(`{"selector":"other"}`),
		NotBefore:   time.Now().Add(-1 * time.Second),
	})
	if err != nil {
		t.Fatalf("enqueue other-scope payload failed: %v", err)
	}

	claimedB, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-b",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-b claim while scope leased failed: %v", err)
	}
	for _, item := range claimedB {
		if item.ScopeID == scopeID {
			t.Fatalf("worker-b should not claim leased scope %s while worker-a owns it", scopeID)
		}
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           claimedA[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: claimedA[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("worker-a ack failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatalf("expected processed rows to be deleted on ack")
	}

	// After release, newly enqueued payload for the same scope should be claimable.
	nextClaim, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-c",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("worker-c claim after ack failed: %v", err)
	}

	var foundScope bool
	for _, item := range nextClaim {
		if item.ScopeID != scopeID {
			continue
		}
		foundScope = true
		if len(item.Payloads) != 1 {
			t.Fatalf("expected only new payload to remain for scope %s, got %d", scopeID, len(item.Payloads))
		}
		if item.Payloads[0].Key != "payload-c" {
			t.Fatalf("expected remaining payload key payload-c, got %s", item.Payloads[0].Key)
		}
	}
	if !foundScope {
		t.Fatalf("expected scope %s to be claimable after ack release", scopeID)
	}
}

func TestQueue_ValidationAndOwnershipErrors(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	ctx := context.Background()

	if err := queue.Enqueue(ctx, reconcile.EnqueueParams{}); !errors.Is(err, reconcile.ErrMissingWorkspaceID) {
		t.Fatalf("expected ErrMissingWorkspaceID, got %v", err)
	}
	if err := queue.Enqueue(ctx, reconcile.EnqueueParams{WorkspaceID: uuid.NewString()}); !errors.Is(err, reconcile.ErrMissingKind) {
		t.Fatalf("expected ErrMissingKind, got %v", err)
	}
	if err := queue.Enqueue(ctx, reconcile.EnqueueParams{WorkspaceID: "bad-uuid", Kind: "k"}); err == nil {
		t.Fatal("expected parse workspace_id error")
	}
	if err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: uuid.NewString(),
		Kind:        "k",
		Payload:     json.RawMessage("{invalid"),
	}); err == nil {
		t.Fatal("expected payload normalization error")
	}

	if _, err := queue.Claim(ctx, reconcile.ClaimParams{}); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if _, err := queue.Claim(ctx, reconcile.ClaimParams{WorkerID: "w"}); !errors.Is(err, reconcile.ErrInvalidBatchSize) {
		t.Fatalf("expected ErrInvalidBatchSize, got %v", err)
	}
	if _, err := queue.Claim(ctx, reconcile.ClaimParams{WorkerID: "w", BatchSize: 1}); !errors.Is(err, reconcile.ErrInvalidLeaseDuration) {
		t.Fatalf("expected ErrInvalidLeaseDuration, got %v", err)
	}

	if err := queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{}); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{WorkerID: "w"}); !errors.Is(err, reconcile.ErrInvalidLeaseDuration) {
		t.Fatalf("expected ErrInvalidLeaseDuration, got %v", err)
	}

	if _, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{}); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if _, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           123456,
		WorkerID:         "w",
		ClaimedUpdatedAt: time.Now(),
	}); !errors.Is(err, reconcile.ErrClaimNotOwned) {
		t.Fatalf("expected ErrClaimNotOwned for unknown ack item, got %v", err)
	}

	if err := queue.Retry(ctx, reconcile.RetryParams{}); !errors.Is(err, reconcile.ErrMissingWorkerID) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.Retry(ctx, reconcile.RetryParams{WorkerID: "w"}); !errors.Is(err, reconcile.ErrInvalidRetryBackoff) {
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

func TestQueue_AckReturnsDeletedFalseForNewerPayload(t *testing.T) {
	pool := requireDB(t)
	queue := New(pool)
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()
	t.Cleanup(func() { cleanupWorkspaceItems(t, pool, workspaceID) })

	ctx := context.Background()
	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "stable",
		Payload:     json.RawMessage(`{"v":1}`),
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
		t.Fatalf("expected 1 item, got %d", len(items))
	}

	// Update same payload identity after claim; payload updated_at becomes newer
	// than the claimed snapshot cutoff.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		PayloadType: "selector_eval",
		PayloadKey:  "stable",
		Payload:     json.RawMessage(`{"v":2}`),
	})
	if err != nil {
		t.Fatalf("re-enqueue same payload failed: %v", err)
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           items[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: items[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack failed: %v", err)
	}
	if ack.Deleted {
		t.Fatal("expected deleted=false when all payload rows are newer than claim snapshot")
	}
}

func TestQueue_Helpers(t *testing.T) {
	payload, key, hasPayload, err := normalizePayload("", "", nil)
	if err != nil {
		t.Fatalf("normalize empty payload failed: %v", err)
	}
	if len(payload) != 0 || key != "" || hasPayload {
		t.Fatalf("unexpected empty normalize result payload=%s key=%q", payload, key)
	}

	payload, key, hasPayload, err = normalizePayload("t", "", json.RawMessage(`{"b":1,"a":2}`))
	if err != nil {
		t.Fatalf("normalize payload failed: %v", err)
	}
	if key == "" || len(payload) == 0 || !hasPayload {
		t.Fatalf("expected normalized payload and generated key, got payload=%s key=%q", payload, key)
	}

	if _, _, _, err := normalizePayload("t", "", json.RawMessage("{bad")); err == nil {
		t.Fatal("expected normalize payload JSON error")
	}

	got, err := decodeClaimedPayloads(nil)
	if err != nil {
		t.Fatalf("decode empty payloads failed: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil payloads for empty input, got %+v", got)
	}

	if _, err := decodeClaimedPayloads([]byte("{bad")); err == nil {
		t.Fatal("expected decode JSON error")
	}

	item, err := toClaimedItem(
		1,
		uuid.NewString(),
		"k",
		"s",
		"id",
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		10,
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		1,
		"",
		"w",
		pgtype.Timestamptz{},
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		nil,
	)
	if err != nil {
		t.Fatalf("toClaimedItem failed: %v", err)
	}
	if item.ClaimedUntil != nil {
		t.Fatalf("expected nil claimed_until when pgtype is invalid")
	}

	if _, err := toClaimedItem(
		1,
		uuid.NewString(),
		"k",
		"s",
		"id",
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		10,
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		1,
		"",
		"w",
		pgtype.Timestamptz{},
		pgtype.Timestamptz{Time: time.Now(), Valid: true},
		[]byte("{bad"),
	); err == nil {
		t.Fatal("expected toClaimedItem decode error for invalid payload JSON")
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

func TestNormalizePayload_PreservesProvidedKey(t *testing.T) {
	payload, key, hasPayload, err := normalizePayload("selector_eval", "fixed-key", json.RawMessage(`{"x":1}`))
	if err != nil {
		t.Fatalf("normalize payload with provided key failed: %v", err)
	}
	if string(payload) == "" {
		t.Fatal("expected normalized payload bytes")
	}
	if !hasPayload {
		t.Fatal("expected hasPayload=true for provided payload")
	}
	if key != "fixed-key" {
		t.Fatalf("expected provided key to be preserved, got %q", key)
	}
}

func TestQueue_ClaimAndAck_NoPayloadScope(t *testing.T) {
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
		t.Fatalf("enqueue no-payload item failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim no-payload item failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one claimed no-payload scope, got %d", len(items))
	}
	if len(items[0].Payloads) != 0 {
		t.Fatalf("expected zero payloads for no-payload scope, got %d", len(items[0].Payloads))
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           items[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: items[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack no-payload item failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatal("expected deleted=true after acking no-payload scope")
	}

	next, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim after no-payload ack failed: %v", err)
	}
	if len(next) != 0 {
		t.Fatalf("expected queue to be empty after no-payload ack, got %+v", next)
	}
}

func TestQueue_Retry_NoPayloadScope_ReappearsAfterBackoff(t *testing.T) {
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
		t.Fatalf("enqueue no-payload item failed: %v", err)
	}

	items, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: 2 * time.Second,
	})
	if err != nil {
		t.Fatalf("claim no-payload item failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one claimed no-payload scope, got %d", len(items))
	}

	err = queue.Retry(ctx, reconcile.RetryParams{
		ItemID:       items[0].ID,
		WorkerID:     "worker-a",
		LastError:    "transient no-payload failure",
		RetryBackoff: 1 * time.Second,
	})
	if err != nil {
		t.Fatalf("retry no-payload item failed: %v", err)
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
		t.Fatalf("expected no-payload scope to reappear after backoff, got %d", len(afterBackoff))
	}
	if len(afterBackoff[0].Payloads) != 0 {
		t.Fatalf("expected zero payloads after retry on no-payload scope, got %d", len(afterBackoff[0].Payloads))
	}
}
