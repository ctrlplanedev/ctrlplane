package memory

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/reconcile"
)

const defaultPriority int16 = 100

var _ reconcile.Queue = (*Queue)(nil)

type Queue struct {
	backend    *backend
	claimKinds map[string]struct{}
}

type backend struct {
	mu         sync.Mutex
	nextScope  int64
	scopes     map[int64]*scope
	scopeIndex map[string]int64
}

type scope struct {
	ID           int64
	WorkspaceID  string
	Kind         string
	ScopeType    string
	ScopeID      string
	EventTS      time.Time
	Priority     int16
	NotBefore    time.Time
	AttemptCount int32
	LastError    string
	ClaimedBy    string
	ClaimedUntil *time.Time
	UpdatedAt    time.Time
}

func New() *Queue {
	return &Queue{
		backend: &backend{
			nextScope:  1,
			scopes:     map[int64]*scope{},
			scopeIndex: map[string]int64{},
		},
		claimKinds: map[string]struct{}{},
	}
}

func NewForKinds(kinds ...string) *Queue {
	return New().ForKinds(kinds...)
}

func (q *Queue) ForKinds(kinds ...string) *Queue {
	filtered := &Queue{
		backend:    q.backend,
		claimKinds: map[string]struct{}{},
	}
	for _, kind := range kinds {
		if kind != "" {
			filtered.claimKinds[kind] = struct{}{}
		}
	}
	return filtered
}

func (q *Queue) Enqueue(ctx context.Context, params reconcile.EnqueueParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkspaceID == "" {
		return reconcile.ErrMissingWorkspaceID
	}
	if params.Kind == "" {
		return reconcile.ErrMissingKind
	}
	if _, err := uuid.Parse(params.WorkspaceID); err != nil {
		return fmt.Errorf("parse workspace_id as uuid: %w", err)
	}

	eventTS := params.EventTS
	if eventTS.IsZero() {
		eventTS = time.Now()
	}
	notBefore := params.NotBefore
	if notBefore.IsZero() {
		notBefore = time.Now().Add(-1 * time.Second)
	}
	priority := params.Priority
	if priority == 0 {
		priority = defaultPriority
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	now := time.Now()
	scopeKey := makeScopeKey(params.WorkspaceID, params.Kind, params.ScopeType, params.ScopeID)
	scopeID, exists := q.backend.scopeIndex[scopeKey]
	if !exists {
		scopeID = q.backend.nextScope
		q.backend.nextScope++
		q.backend.scopes[scopeID] = &scope{
			ID:          scopeID,
			WorkspaceID: params.WorkspaceID,
			Kind:        params.Kind,
			ScopeType:   params.ScopeType,
			ScopeID:     params.ScopeID,
			EventTS:     eventTS,
			Priority:    priority,
			NotBefore:   notBefore,
			UpdatedAt:   now,
		}
		q.backend.scopeIndex[scopeKey] = scopeID
		return nil
	}

	s := q.backend.scopes[scopeID]

	// Skip update if currently claimed (mirrors the Postgres WHERE clause).
	if s.ClaimedUntil != nil && s.ClaimedUntil.After(now) {
		return nil
	}

	if eventTS.After(s.EventTS) {
		s.EventTS = eventTS
	}
	if priority < s.Priority {
		s.Priority = priority
	}
	if notBefore.Before(s.NotBefore) {
		s.NotBefore = notBefore
	}

	if s.ClaimedUntil != nil && s.ClaimedUntil.Before(now) {
		s.ClaimedBy = ""
		s.ClaimedUntil = nil
	}
	s.UpdatedAt = now
	return nil
}

func (q *Queue) EnqueueMany(ctx context.Context, params []reconcile.EnqueueParams) error {
	for _, p := range params {
		if err := q.Enqueue(ctx, p); err != nil {
			return err
		}
	}
	return nil
}

func (q *Queue) Claim(ctx context.Context, params reconcile.ClaimParams) ([]reconcile.Item, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if params.WorkerID == "" {
		return nil, reconcile.ErrMissingWorkerID
	}
	if params.BatchSize <= 0 {
		return nil, reconcile.ErrInvalidBatchSize
	}
	if params.LeaseDuration <= 0 {
		return nil, reconcile.ErrInvalidLeaseDuration
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	now := time.Now()
	candidates := make([]*scope, 0, len(q.backend.scopes))
	for _, s := range q.backend.scopes {
		if len(q.claimKinds) > 0 {
			if _, ok := q.claimKinds[s.Kind]; !ok {
				continue
			}
		}
		if s.NotBefore.After(now) {
			continue
		}
		if s.ClaimedUntil != nil && s.ClaimedUntil.After(now) {
			continue
		}
		candidates = append(candidates, s)
	}
	slices.SortFunc(candidates, func(a, b *scope) int {
		if a.Priority != b.Priority {
			if a.Priority < b.Priority {
				return -1
			}
			return 1
		}
		if !a.EventTS.Equal(b.EventTS) {
			if a.EventTS.Before(b.EventTS) {
				return -1
			}
			return 1
		}
		if a.ID < b.ID {
			return -1
		}
		if a.ID > b.ID {
			return 1
		}
		return 0
	})

	claimCount := min(params.BatchSize, len(candidates))
	out := make([]reconcile.Item, 0, claimCount)
	for i := range claimCount {
		s := candidates[i]
		claimedUntil := now.Add(params.LeaseDuration)
		s.ClaimedBy = params.WorkerID
		s.ClaimedUntil = &claimedUntil
		s.UpdatedAt = now
		out = append(out, toItem(s))
	}
	return out, nil
}

func (q *Queue) ExtendLease(ctx context.Context, params reconcile.ExtendLeaseParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkerID == "" {
		return reconcile.ErrMissingWorkerID
	}
	if params.LeaseDuration <= 0 {
		return reconcile.ErrInvalidLeaseDuration
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID {
		return reconcile.ErrClaimNotOwned
	}
	now := time.Now()
	claimedUntil := now.Add(params.LeaseDuration)
	s.ClaimedUntil = &claimedUntil
	s.UpdatedAt = now
	return nil
}

func (q *Queue) AckSuccess(
	ctx context.Context,
	params reconcile.AckSuccessParams,
) (reconcile.AckSuccessResult, error) {
	if err := ctx.Err(); err != nil {
		return reconcile.AckSuccessResult{}, err
	}
	if params.WorkerID == "" {
		return reconcile.AckSuccessResult{}, reconcile.ErrMissingWorkerID
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID || s.UpdatedAt.After(params.ClaimedUpdatedAt) {
		return reconcile.AckSuccessResult{}, reconcile.ErrClaimNotOwned
	}

	delete(q.backend.scopes, s.ID)
	delete(q.backend.scopeIndex, makeScopeKey(s.WorkspaceID, s.Kind, s.ScopeType, s.ScopeID))
	return reconcile.AckSuccessResult{Deleted: true}, nil
}

func (q *Queue) Retry(ctx context.Context, params reconcile.RetryParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkerID == "" {
		return reconcile.ErrMissingWorkerID
	}
	if params.RetryBackoff <= 0 {
		return reconcile.ErrInvalidRetryBackoff
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID {
		return reconcile.ErrClaimNotOwned
	}

	now := time.Now()
	s.AttemptCount++
	s.LastError = params.LastError
	s.NotBefore = now.Add(params.RetryBackoff)
	s.ClaimedBy = ""
	s.ClaimedUntil = nil
	s.UpdatedAt = now
	return nil
}

func toItem(s *scope) reconcile.Item {
	var claimedUntil *time.Time
	if s.ClaimedUntil != nil {
		t := *s.ClaimedUntil
		claimedUntil = &t
	}

	return reconcile.Item{
		ID:           s.ID,
		WorkspaceID:  s.WorkspaceID,
		Kind:         s.Kind,
		ScopeType:    s.ScopeType,
		ScopeID:      s.ScopeID,
		EventTS:      s.EventTS,
		Priority:     s.Priority,
		NotBefore:    s.NotBefore,
		AttemptCount: s.AttemptCount,
		LastError:    s.LastError,
		ClaimedBy:    s.ClaimedBy,
		ClaimedUntil: claimedUntil,
		UpdatedAt:    s.UpdatedAt,
	}
}

func makeScopeKey(workspaceID, kind, scopeType, scopeID string) string {
	return workspaceID + "\x00" + kind + "\x00" + scopeType + "\x00" + scopeID
}
