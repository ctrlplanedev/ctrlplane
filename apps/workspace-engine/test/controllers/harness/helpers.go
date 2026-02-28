package harness

import (
	"context"
	"time"

	"workspace-engine/pkg/reconcile"
)

const testWorkerID = "test-worker"

// RequeueRecord captures an item that was re-enqueued with a future NotBefore.
type RequeueRecord struct {
	WorkspaceID  string
	Kind         string
	ScopeType    string
	ScopeID      string
	RequeueAfter time.Duration
}

// DrainResult holds the outcome of a DrainQueue call.
type DrainResult struct {
	Processed int
	Requeued  []RequeueRecord
}

// DrainQueue claims and processes all currently claimable items from the
// queue, matching the real reconcile.Worker settle behaviour:
//   - On success with RequeueAfter > 0: record the requeue, re-enqueue
//     with NotBefore, then ack.
//   - On success without requeue: ack.
func DrainQueue(ctx context.Context, queue reconcile.Queue, processor reconcile.Processor) (DrainResult, error) {
	var res DrainResult
	for {
		items, err := queue.Claim(ctx, reconcile.ClaimParams{
			WorkerID:      testWorkerID,
			BatchSize:     100,
			LeaseDuration: 30 * time.Second,
		})
		if err != nil {
			return res, err
		}
		if len(items) == 0 {
			return res, nil
		}
		for _, item := range items {
			result, err := processor.Process(ctx, item)
			if err != nil {
				return res, err
			}

			if result.RequeueAfter > 0 {
				res.Requeued = append(res.Requeued, RequeueRecord{
					WorkspaceID:  item.WorkspaceID,
					Kind:         item.Kind,
					ScopeType:    item.ScopeType,
					ScopeID:      item.ScopeID,
					RequeueAfter: result.RequeueAfter,
				})
				_ = queue.Enqueue(ctx, reconcile.EnqueueParams{
					WorkspaceID: item.WorkspaceID,
					Kind:        item.Kind,
					ScopeType:   item.ScopeType,
					ScopeID:     item.ScopeID,
					EventTS:     time.Now(),
					Priority:    item.Priority,
					NotBefore:   time.Now().Add(result.RequeueAfter),
				})
			}

			_, _ = queue.AckSuccess(ctx, reconcile.AckSuccessParams{
				ItemID:           item.ID,
				WorkerID:         testWorkerID,
				ClaimedUpdatedAt: item.UpdatedAt,
			})
			res.Processed++
		}
	}
}

// NewItem creates a reconcile.Item suitable for direct injection into a
// controller's Process method.
func NewItem(kind, scopeType, scopeID, workspaceID string) reconcile.Item {
	return reconcile.Item{
		ID:          1,
		WorkspaceID: workspaceID,
		Kind:        kind,
		ScopeType:   scopeType,
		ScopeID:     scopeID,
		EventTS:     time.Now(),
	}
}
