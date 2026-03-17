package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	reconcile "workspace-engine/pkg/reconcile"
)

func TestQueue_EnqueueClaimAckLifecycle(t *testing.T) {
	queue := New()
	ctx := context.Background()

	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: uuid.NewString(),
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
		t.Fatalf("expected one claimed item, got %d", len(items))
	}

	if err := queue.ExtendLease(ctx, reconcile.ExtendLeaseParams{
		ItemID:        items[0].ID,
		WorkerID:      "worker-b",
		LeaseDuration: time.Second,
	}); !errors.Is(err, reconcile.ErrClaimNotOwned) {
		t.Fatalf("expected ErrClaimNotOwned for wrong worker extend, got %v", err)
	}

	ack, err := queue.AckSuccess(ctx, reconcile.AckSuccessParams{
		ItemID:           items[0].ID,
		WorkerID:         "worker-a",
		ClaimedUpdatedAt: items[0].UpdatedAt,
	})
	if err != nil {
		t.Fatalf("ack failed: %v", err)
	}
	if !ack.Deleted {
		t.Fatal("expected deleted=true")
	}

	claimedAgain, err := queue.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     1,
		WorkerID:      "worker-a",
		LeaseDuration: time.Second,
	})
	if err != nil {
		t.Fatalf("second claim failed: %v", err)
	}
	if len(claimedAgain) != 0 {
		t.Fatalf("expected queue to be empty, got %d", len(claimedAgain))
	}
}

func TestQueue_FilteredClaimAndRetry(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.NewString()
	all := New()
	filtered := all.ForKinds("deploymentresourceselectoreval")

	err := all.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "deploymentresourceselectoreval",
		ScopeType:   "deployment",
		ScopeID:     uuid.NewString(),
	})
	if err != nil {
		t.Fatalf("enqueue kind A failed: %v", err)
	}

	err = filtered.Enqueue(ctx, reconcile.EnqueueParams{
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
		LeaseDuration: time.Second,
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
		RetryBackoff: 120 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("retry failed: %v", err)
	}

	immediate, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: time.Second,
	})
	if err != nil {
		t.Fatalf("immediate claim failed: %v", err)
	}
	if len(immediate) != 0 {
		t.Fatalf("expected no immediate claim after retry, got %d", len(immediate))
	}

	time.Sleep(140 * time.Millisecond)
	afterBackoff, err := filtered.Claim(ctx, reconcile.ClaimParams{
		BatchSize:     10,
		WorkerID:      "worker-filtered",
		LeaseDuration: time.Second,
	})
	if err != nil {
		t.Fatalf("claim after backoff failed: %v", err)
	}
	if len(afterBackoff) != 1 {
		t.Fatalf("expected one item after backoff, got %d", len(afterBackoff))
	}
	if afterBackoff[0].AttemptCount < 1 {
		t.Fatalf("expected attempt_count to increment, got %d", afterBackoff[0].AttemptCount)
	}
	if afterBackoff[0].LastError == "" {
		t.Fatal("expected last_error to be set after retry")
	}
}

func TestQueue_ValidationErrors(t *testing.T) {
	queue := New()
	ctx := context.Background()

	if err := queue.Enqueue(
		ctx,
		reconcile.EnqueueParams{},
	); !errors.Is(
		err,
		reconcile.ErrMissingWorkspaceID,
	) {
		t.Fatalf("expected ErrMissingWorkspaceID, got %v", err)
	}
	if err := queue.Enqueue(
		ctx,
		reconcile.EnqueueParams{WorkspaceID: "bad", Kind: "k"},
	); err == nil {
		t.Fatal("expected workspace uuid parse error")
	}

	if _, err := queue.Claim(
		ctx,
		reconcile.ClaimParams{},
	); !errors.Is(
		err,
		reconcile.ErrMissingWorkerID,
	) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.ExtendLease(
		ctx,
		reconcile.ExtendLeaseParams{},
	); !errors.Is(
		err,
		reconcile.ErrMissingWorkerID,
	) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if _, err := queue.AckSuccess(
		ctx,
		reconcile.AckSuccessParams{},
	); !errors.Is(
		err,
		reconcile.ErrMissingWorkerID,
	) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
	if err := queue.Retry(
		ctx,
		reconcile.RetryParams{},
	); !errors.Is(
		err,
		reconcile.ErrMissingWorkerID,
	) {
		t.Fatalf("expected ErrMissingWorkerID, got %v", err)
	}
}

func TestQueue_EnqueueSkipsClaimedScope(t *testing.T) {
	queue := New()
	ctx := context.Background()
	workspaceID := uuid.NewString()
	scopeID := uuid.NewString()

	err := queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "eval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		Priority:    50,
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

	// Enqueue for the same scope while claimed should be silently skipped.
	err = queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "eval",
		ScopeType:   "deployment",
		ScopeID:     scopeID,
		Priority:    10,
	})
	if err != nil {
		t.Fatalf("enqueue during claim failed: %v", err)
	}
}
