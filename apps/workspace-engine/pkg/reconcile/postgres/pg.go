//go:generate sqlc generate
package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/reconcile"
	sqldb "workspace-engine/pkg/reconcile/postgres/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultPriority int16 = 100

var _ reconcile.Queue = (*Queue)(nil)

// Queue implements reconcile.Queue using a two-table PostgreSQL model:
// - reconcile_work_scope: leasing and scheduling per logical scope key
// - reconcile_work_payload: payload variants attached to a scope
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

func (q *Queue) Enqueue(ctx context.Context, params reconcile.EnqueueParams) error {
	if params.WorkspaceID == "" {
		return reconcile.ErrMissingWorkspaceID
	}
	if params.Kind == "" {
		return reconcile.ErrMissingKind
	}

	eventTS := params.EventTS
	if eventTS.IsZero() {
		eventTS = time.Now()
	}

	notBefore := params.NotBefore
	if notBefore.IsZero() {
		// Default to immediately claimable even when app/db clocks differ slightly.
		notBefore = time.Now().Add(-1 * time.Second)
	}

	priority := params.Priority
	if priority == 0 {
		priority = defaultPriority
	}

	workspaceID, err := uuid.Parse(params.WorkspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id as uuid: %w", err)
	}

	payload, payloadKey, hasPayload, err := normalizePayload(params.PayloadType, params.PayloadKey, params.Payload)
	if err != nil {
		return fmt.Errorf("normalize payload: %w", err)
	}

	err = q.queries.UpsertReconcileWorkItem(ctx, sqldb.UpsertReconcileWorkItemParams{
		WorkspaceID: workspaceID,
		Kind:        params.Kind,
		ScopeType:   params.ScopeType,
		ScopeID:     params.ScopeID,
		HasPayload:  hasPayload,
		PayloadType: params.PayloadType,
		PayloadKey:  payloadKey,
		Payload:     payload,
		EventTs:     pgtype.Timestamptz{Time: eventTS, Valid: true},
		Priority:    priority,
		NotBefore:   pgtype.Timestamptz{Time: notBefore, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("enqueue work item: %w", err)
	}
	return nil
}

func (q *Queue) Claim(ctx context.Context, params reconcile.ClaimParams) ([]reconcile.Item, error) {
	if params.WorkerID == "" {
		return nil, reconcile.ErrMissingWorkerID
	}
	if params.BatchSize <= 0 {
		return nil, reconcile.ErrInvalidBatchSize
	}
	if params.LeaseDuration <= 0 {
		return nil, reconcile.ErrInvalidLeaseDuration
	}

	items := make([]reconcile.Item, 0, params.BatchSize)
	if len(q.claimKinds) == 0 {
		rows, err := q.queries.ClaimReconcileWorkItems(ctx, sqldb.ClaimReconcileWorkItemsParams{
			BatchSize:    int64(params.BatchSize),
			ClaimedBy:    pgtype.Text{String: params.WorkerID, Valid: true},
			LeaseSeconds: int32(params.LeaseDuration.Seconds()),
		})
		if err != nil {
			return nil, fmt.Errorf("claim work items: %w", err)
		}
		for _, row := range rows {
			item, err := toClaimedItem(
				row.ID,
				row.WorkspaceID.String(),
				row.Kind,
				row.ScopeType,
				row.ScopeID,
				row.EventTs,
				row.Priority,
				row.NotBefore,
				row.AttemptCount,
				row.LastError,
				row.ClaimedBy,
				row.ClaimedUntil,
				row.UpdatedAt,
				row.Payloads,
			)
			if err != nil {
				return nil, fmt.Errorf("decode claimed payloads: %w", err)
			}
			items = append(items, item)
		}
	} else {
		rows, err := q.queries.ClaimReconcileWorkItemsByKinds(ctx, sqldb.ClaimReconcileWorkItemsByKindsParams{
			ClaimedBy:    pgtype.Text{String: params.WorkerID, Valid: true},
			LeaseSeconds: int32(params.LeaseDuration.Seconds()),
			Kinds:        q.claimKinds,
			BatchSize:    int64(params.BatchSize),
		})
		if err != nil {
			return nil, fmt.Errorf("claim work items: %w", err)
		}
		for _, row := range rows {
			item, err := toClaimedItem(
				row.ID,
				row.WorkspaceID.String(),
				row.Kind,
				row.ScopeType,
				row.ScopeID,
				row.EventTs,
				row.Priority,
				row.NotBefore,
				row.AttemptCount,
				row.LastError,
				row.ClaimedBy,
				row.ClaimedUntil,
				row.UpdatedAt,
				row.Payloads,
			)
			if err != nil {
				return nil, fmt.Errorf("decode claimed payloads: %w", err)
			}
			items = append(items, item)
		}
	}
	return items, nil
}

func (q *Queue) ExtendLease(ctx context.Context, params reconcile.ExtendLeaseParams) error {
	if params.WorkerID == "" {
		return reconcile.ErrMissingWorkerID
	}
	if params.LeaseDuration <= 0 {
		return reconcile.ErrInvalidLeaseDuration
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
		return reconcile.ErrClaimNotOwned
	}
	return nil
}

type claimedPayload struct {
	Type    string          `json:"type"`
	Key     string          `json:"key"`
	Payload json.RawMessage `json:"payload"`
}

func normalizePayload(payloadType, payloadKey string, payload any) ([]byte, string, bool, error) {
	if payload == nil {
		return nil, "", false, nil
	}

	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, "", false, err
	}

	var decoded any
	if err := json.Unmarshal(rawPayload, &decoded); err != nil {
		return nil, "", false, err
	}
	normalized, err := json.Marshal(decoded)
	if err != nil {
		return nil, "", false, err
	}
	if payloadKey == "" {
		sum := sha256.Sum256(append([]byte(payloadType+":"), normalized...))
		payloadKey = fmt.Sprintf("%x", sum[:])
	}
	return normalized, payloadKey, true, nil
}

func toClaimedItem(
	id int64,
	workspaceID string,
	kind string,
	scopeType string,
	scopeID string,
	eventTS pgtype.Timestamptz,
	priority int16,
	notBefore pgtype.Timestamptz,
	attemptCount int32,
	lastError string,
	claimedBy string,
	claimedUntil pgtype.Timestamptz,
	updatedAt pgtype.Timestamptz,
	rawPayloads []byte,
) (reconcile.Item, error) {
	payloads, err := decodeClaimedPayloads(rawPayloads)
	if err != nil {
		return reconcile.Item{}, err
	}

	item := reconcile.Item{
		ID:           id,
		WorkspaceID:  workspaceID,
		Kind:         kind,
		ScopeType:    scopeType,
		ScopeID:      scopeID,
		Payloads:     payloads,
		EventTS:      eventTS.Time,
		Priority:     priority,
		NotBefore:    notBefore.Time,
		AttemptCount: attemptCount,
		LastError:    lastError,
		ClaimedBy:    claimedBy,
		UpdatedAt:    updatedAt.Time,
	}
	if claimedUntil.Valid {
		t := claimedUntil.Time
		item.ClaimedUntil = &t
	}
	return item, nil
}

func decodeClaimedPayloads(rawPayloads []byte) ([]reconcile.Payload, error) {
	if len(rawPayloads) == 0 {
		return nil, nil
	}

	var claimedPayloads []claimedPayload
	if err := json.Unmarshal(rawPayloads, &claimedPayloads); err != nil {
		return nil, err
	}

	payloads := make([]reconcile.Payload, 0, len(claimedPayloads))
	for _, payload := range claimedPayloads {
		payloads = append(payloads, reconcile.Payload{
			Type:  payload.Type,
			Key:   payload.Key,
			Value: payload.Payload,
		})
	}
	return payloads, nil
}

func (q *Queue) AckSuccess(ctx context.Context, params reconcile.AckSuccessParams) (reconcile.AckSuccessResult, error) {
	if params.WorkerID == "" {
		return reconcile.AckSuccessResult{}, reconcile.ErrMissingWorkerID
	}

	result, err := q.queries.DeleteClaimedReconcileWorkItemIfUnchanged(ctx, sqldb.DeleteClaimedReconcileWorkItemIfUnchangedParams{
		ID:        params.ItemID,
		ClaimedBy: pgtype.Text{String: params.WorkerID, Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: params.ClaimedUpdatedAt, Valid: true},
	})
	if err != nil {
		return reconcile.AckSuccessResult{}, fmt.Errorf("ack success delete claimed item: %w", err)
	}
	if !result.Owned {
		return reconcile.AckSuccessResult{}, reconcile.ErrClaimNotOwned
	}
	return reconcile.AckSuccessResult{
		Deleted: result.DeletedPayloadCount > 0 || result.ScopeDeleted,
	}, nil
}

func (q *Queue) Retry(ctx context.Context, params reconcile.RetryParams) error {
	if params.WorkerID == "" {
		return reconcile.ErrMissingWorkerID
	}
	if params.RetryBackoff <= 0 {
		return reconcile.ErrInvalidRetryBackoff
	}

	result, err := q.queries.RetryReconcileWorkItem(ctx, sqldb.RetryReconcileWorkItemParams{
		ID:                  params.ItemID,
		ClaimedBy:           pgtype.Text{String: params.WorkerID, Valid: true},
		LastError:           pgtype.Text{String: params.LastError, Valid: true},
		RetryBackoffSeconds: int32(params.RetryBackoff.Seconds()),
	})
	if err != nil {
		return fmt.Errorf("retry work item: %w", err)
	}
	if !result.Owned {
		return reconcile.ErrClaimNotOwned
	}
	return nil
}
