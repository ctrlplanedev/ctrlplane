//go:generate sqlc generate
package postgres

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/workqueue"
	sqldb "workspace-engine/pkg/workqueue/postgres/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultPriority int16 = 100

// Queue implements workqueue.Queue using a PostgreSQL table named
// reconcile_work_item.
type Queue struct {
	queries    *sqldb.Queries
	claimKinds []string
}

func New(pool *pgxpool.Pool) *Queue {
	return &Queue{queries: sqldb.New(pool)}
}

// NewForKinds returns a queue instance that only claims work items whose kind
// matches one of the provided kinds.
func NewForKinds(pool *pgxpool.Pool, kinds ...string) *Queue {
	filteredKinds := make([]string, 0, len(kinds))
	for _, kind := range kinds {
		if kind != "" {
			filteredKinds = append(filteredKinds, kind)
		}
	}
	return &Queue{
		queries:    sqldb.New(pool),
		claimKinds: filteredKinds,
	}
}

func (q *Queue) Enqueue(ctx context.Context, params workqueue.EnqueueParams) error {
	if params.WorkspaceID == "" {
		return workqueue.ErrMissingWorkspaceID
	}
	if params.Kind == "" {
		return workqueue.ErrMissingKind
	}

	eventTS := params.EventTS
	if eventTS.IsZero() {
		eventTS = time.Now()
	}

	notBefore := params.NotBefore
	if notBefore.IsZero() {
		notBefore = time.Now()
	}

	priority := params.Priority
	if priority == 0 {
		priority = defaultPriority
	}

	workspaceID, err := uuid.Parse(params.WorkspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id as uuid: %w", err)
	}

	err = q.queries.UpsertReconcileWorkItem(ctx, sqldb.UpsertReconcileWorkItemParams{
		WorkspaceID: workspaceID,
		Kind:        params.Kind,
		ScopeType:   params.ScopeType,
		ScopeID:     params.ScopeID,
		EventTs:     pgtype.Timestamptz{Time: eventTS, Valid: true},
		Priority:    priority,
		NotBefore:   pgtype.Timestamptz{Time: notBefore, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("enqueue work item: %w", err)
	}
	return nil
}

func (q *Queue) Claim(ctx context.Context, params workqueue.ClaimParams) ([]workqueue.Item, error) {
	if params.WorkerID == "" {
		return nil, workqueue.ErrMissingWorkerID
	}
	if params.BatchSize <= 0 {
		return nil, workqueue.ErrInvalidBatchSize
	}
	if params.LeaseDuration <= 0 {
		return nil, workqueue.ErrInvalidLeaseDuration
	}

	items := make([]workqueue.Item, 0, params.BatchSize)
	if len(q.claimKinds) == 0 {
		rows, err := q.queries.ClaimReconcileWorkItems(ctx, sqldb.ClaimReconcileWorkItemsParams{
			ClaimedBy:    pgtype.Text{String: params.WorkerID, Valid: true},
			LeaseSeconds: int32(params.LeaseDuration.Seconds()),
			BatchSize:    int32(params.BatchSize),
		})
		if err != nil {
			return nil, fmt.Errorf("claim work items: %w", err)
		}
		for _, row := range rows {
			item := workqueue.Item{
				ID:           row.ID,
				WorkspaceID:  row.WorkspaceID.String(),
				Kind:         row.Kind,
				ScopeType:    row.ScopeType,
				ScopeID:      row.ScopeID,
				EventTS:      row.EventTs.Time,
				Priority:     row.Priority,
				NotBefore:    row.NotBefore.Time,
				AttemptCount: row.AttemptCount,
				LastError:    row.LastError,
				ClaimedBy:    row.ClaimedBy,
				UpdatedAt:    row.UpdatedAt.Time,
			}
			if row.ClaimedUntil.Valid {
				t := row.ClaimedUntil.Time
				item.ClaimedUntil = &t
			}
			items = append(items, item)
		}
	} else {
		rows, err := q.queries.ClaimReconcileWorkItemsByKinds(ctx, sqldb.ClaimReconcileWorkItemsByKindsParams{
			ClaimedBy:    pgtype.Text{String: params.WorkerID, Valid: true},
			LeaseSeconds: int32(params.LeaseDuration.Seconds()),
			Kinds:        q.claimKinds,
			BatchSize:    int32(params.BatchSize),
		})
		if err != nil {
			return nil, fmt.Errorf("claim work items: %w", err)
		}
		for _, row := range rows {
			item := workqueue.Item{
				ID:           row.ID,
				WorkspaceID:  row.WorkspaceID.String(),
				Kind:         row.Kind,
				ScopeType:    row.ScopeType,
				ScopeID:      row.ScopeID,
				EventTS:      row.EventTs.Time,
				Priority:     row.Priority,
				NotBefore:    row.NotBefore.Time,
				AttemptCount: row.AttemptCount,
				LastError:    row.LastError,
				ClaimedBy:    row.ClaimedBy,
				UpdatedAt:    row.UpdatedAt.Time,
			}
			if row.ClaimedUntil.Valid {
				t := row.ClaimedUntil.Time
				item.ClaimedUntil = &t
			}
			items = append(items, item)
		}
	}
	return items, nil
}

func (q *Queue) ExtendLease(ctx context.Context, params workqueue.ExtendLeaseParams) error {
	if params.WorkerID == "" {
		return workqueue.ErrMissingWorkerID
	}
	if params.LeaseDuration <= 0 {
		return workqueue.ErrInvalidLeaseDuration
	}

	rowsAffected, err := q.queries.ExtendReconcileWorkItemLease(ctx, sqldb.ExtendReconcileWorkItemLeaseParams{
		LeaseSeconds: int32(params.LeaseDuration.Seconds()),
		ID:           params.ItemID,
		ClaimedBy:    pgtype.Text{String: params.WorkerID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("extend lease: %w", err)
	}
	if rowsAffected == 0 {
		return workqueue.ErrClaimNotOwned
	}
	return nil
}

func (q *Queue) AckSuccess(ctx context.Context, params workqueue.AckSuccessParams) (workqueue.AckSuccessResult, error) {
	if params.WorkerID == "" {
		return workqueue.AckSuccessResult{}, workqueue.ErrMissingWorkerID
	}

	rowsAffected, err := q.queries.DeleteClaimedReconcileWorkItemIfUnchanged(ctx, sqldb.DeleteClaimedReconcileWorkItemIfUnchangedParams{
		ID:        params.ItemID,
		ClaimedBy: pgtype.Text{String: params.WorkerID, Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: params.ClaimedUpdatedAt, Valid: true},
	})
	if err != nil {
		return workqueue.AckSuccessResult{}, fmt.Errorf("ack success delete claimed item: %w", err)
	}
	if rowsAffected > 0 {
		return workqueue.AckSuccessResult{Deleted: true}, nil
	}

	rowsAffected, err = q.queries.ReleaseReconcileWorkItemClaim(ctx, sqldb.ReleaseReconcileWorkItemClaimParams{
		ID:        params.ItemID,
		ClaimedBy: pgtype.Text{String: params.WorkerID, Valid: true},
	})
	if err != nil {
		return workqueue.AckSuccessResult{}, fmt.Errorf("ack success release claim: %w", err)
	}
	if rowsAffected == 0 {
		return workqueue.AckSuccessResult{}, workqueue.ErrClaimNotOwned
	}

	return workqueue.AckSuccessResult{Deleted: false}, nil
}

func (q *Queue) Retry(ctx context.Context, params workqueue.RetryParams) error {
	if params.WorkerID == "" {
		return workqueue.ErrMissingWorkerID
	}
	if params.RetryBackoff <= 0 {
		return workqueue.ErrInvalidRetryBackoff
	}

	rowsAffected, err := q.queries.RetryReconcileWorkItem(ctx, sqldb.RetryReconcileWorkItemParams{
		LastError:           pgtype.Text{String: params.LastError, Valid: true},
		RetryBackoffSeconds: int32(params.RetryBackoff.Seconds()),
		ID:                  params.ItemID,
		ClaimedBy:           pgtype.Text{String: params.WorkerID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("retry work item: %w", err)
	}
	if rowsAffected == 0 {
		return workqueue.ErrClaimNotOwned
	}
	return nil
}
