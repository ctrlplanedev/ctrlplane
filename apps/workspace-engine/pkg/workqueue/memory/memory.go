package memory

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"slices"
	"sync"
	"time"
	"workspace-engine/pkg/workqueue"

	"github.com/google/uuid"
)

const defaultPriority int16 = 100

var _ workqueue.Queue = (*Queue)(nil)

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
	ClaimedBy    string
	ClaimedUntil *time.Time
	UpdatedAt    time.Time
	Payloads     map[string]*payload
}

type payload struct {
	Type         string
	Key          string
	Value        []byte
	AttemptCount int32
	LastError    string
	CreatedAt    time.Time
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

func (q *Queue) Enqueue(ctx context.Context, params workqueue.EnqueueParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkspaceID == "" {
		return workqueue.ErrMissingWorkspaceID
	}
	if params.Kind == "" {
		return workqueue.ErrMissingKind
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

	rawPayload, payloadKey, hasPayload, err := normalizePayload(params.PayloadType, params.PayloadKey, params.Payload)
	if err != nil {
		return fmt.Errorf("normalize payload: %w", err)
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
			Payloads:    map[string]*payload{},
		}
		q.backend.scopeIndex[scopeKey] = scopeID
	}

	s := q.backend.scopes[scopeID]
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
	if s.ClaimedUntil == nil || !s.ClaimedUntil.After(now) {
		s.UpdatedAt = now
	}

	if hasPayload {
		payloadID := makePayloadKey(params.PayloadType, payloadKey)
		p, ok := s.Payloads[payloadID]
		if !ok {
			p = &payload{
				Type:      params.PayloadType,
				Key:       payloadKey,
				CreatedAt: now,
			}
			s.Payloads[payloadID] = p
		} else {
			p.CreatedAt = now
		}
		p.Value = slices.Clone(rawPayload)
		p.UpdatedAt = now
	}
	return nil
}

func (q *Queue) Claim(ctx context.Context, params workqueue.ClaimParams) ([]workqueue.Item, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if params.WorkerID == "" {
		return nil, workqueue.ErrMissingWorkerID
	}
	if params.BatchSize <= 0 {
		return nil, workqueue.ErrInvalidBatchSize
	}
	if params.LeaseDuration <= 0 {
		return nil, workqueue.ErrInvalidLeaseDuration
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
	out := make([]workqueue.Item, 0, claimCount)
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

func (q *Queue) ExtendLease(ctx context.Context, params workqueue.ExtendLeaseParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkerID == "" {
		return workqueue.ErrMissingWorkerID
	}
	if params.LeaseDuration <= 0 {
		return workqueue.ErrInvalidLeaseDuration
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID {
		return workqueue.ErrClaimNotOwned
	}
	now := time.Now()
	claimedUntil := now.Add(params.LeaseDuration)
	s.ClaimedUntil = &claimedUntil
	s.UpdatedAt = now
	return nil
}

func (q *Queue) AckSuccess(ctx context.Context, params workqueue.AckSuccessParams) (workqueue.AckSuccessResult, error) {
	if err := ctx.Err(); err != nil {
		return workqueue.AckSuccessResult{}, err
	}
	if params.WorkerID == "" {
		return workqueue.AckSuccessResult{}, workqueue.ErrMissingWorkerID
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID || s.UpdatedAt.After(params.ClaimedUpdatedAt) {
		return workqueue.AckSuccessResult{}, workqueue.ErrClaimNotOwned
	}

	cutoff := s.UpdatedAt
	deletedPayloads := 0
	for key, p := range s.Payloads {
		if p.CreatedAt.After(cutoff) {
			continue
		}
		delete(s.Payloads, key)
		deletedPayloads++
	}

	if len(s.Payloads) == 0 {
		delete(q.backend.scopes, s.ID)
		delete(q.backend.scopeIndex, makeScopeKey(s.WorkspaceID, s.Kind, s.ScopeType, s.ScopeID))
		return workqueue.AckSuccessResult{Deleted: true}, nil
	}

	s.ClaimedBy = ""
	s.ClaimedUntil = nil
	s.UpdatedAt = time.Now()
	return workqueue.AckSuccessResult{Deleted: deletedPayloads > 0}, nil
}

func (q *Queue) Retry(ctx context.Context, params workqueue.RetryParams) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if params.WorkerID == "" {
		return workqueue.ErrMissingWorkerID
	}
	if params.RetryBackoff <= 0 {
		return workqueue.ErrInvalidRetryBackoff
	}

	q.backend.mu.Lock()
	defer q.backend.mu.Unlock()

	s, ok := q.backend.scopes[params.ItemID]
	if !ok || s.ClaimedBy != params.WorkerID {
		return workqueue.ErrClaimNotOwned
	}

	cutoff := s.UpdatedAt
	now := time.Now()
	for _, p := range s.Payloads {
		if p.CreatedAt.After(cutoff) {
			continue
		}
		p.AttemptCount++
		p.LastError = params.LastError
		p.UpdatedAt = now
	}

	s.NotBefore = now.Add(params.RetryBackoff)
	s.ClaimedBy = ""
	s.ClaimedUntil = nil
	s.UpdatedAt = now
	return nil
}

func normalizePayload(payloadType, payloadKey string, payloadData any) ([]byte, string, bool, error) {
	if payloadData == nil {
		return nil, "", false, nil
	}

	rawPayload, err := json.Marshal(payloadData)
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

func toItem(s *scope) workqueue.Item {
	payloads := make([]*payload, 0, len(s.Payloads))
	for _, p := range s.Payloads {
		payloads = append(payloads, p)
	}
	slices.SortFunc(payloads, func(a, b *payload) int {
		if !a.CreatedAt.Equal(b.CreatedAt) {
			if a.CreatedAt.Before(b.CreatedAt) {
				return -1
			}
			return 1
		}
		if a.Key < b.Key {
			return -1
		}
		if a.Key > b.Key {
			return 1
		}
		return 0
	})

	outPayloads := make([]workqueue.Payload, 0, len(payloads))
	var attemptCount int32
	lastError := ""
	for _, p := range payloads {
		if p.AttemptCount > attemptCount {
			attemptCount = p.AttemptCount
		}
		if p.LastError > lastError {
			lastError = p.LastError
		}
		outPayloads = append(outPayloads, workqueue.Payload{
			Type:  p.Type,
			Key:   p.Key,
			Value: slices.Clone(p.Value),
		})
	}

	var claimedUntil *time.Time
	if s.ClaimedUntil != nil {
		t := *s.ClaimedUntil
		claimedUntil = &t
	}

	return workqueue.Item{
		ID:           s.ID,
		WorkspaceID:  s.WorkspaceID,
		Kind:         s.Kind,
		ScopeType:    s.ScopeType,
		ScopeID:      s.ScopeID,
		Payloads:     outPayloads,
		EventTS:      s.EventTS,
		Priority:     s.Priority,
		NotBefore:    s.NotBefore,
		AttemptCount: attemptCount,
		LastError:    lastError,
		ClaimedBy:    s.ClaimedBy,
		ClaimedUntil: claimedUntil,
		UpdatedAt:    s.UpdatedAt,
	}
}

func makeScopeKey(workspaceID, kind, scopeType, scopeID string) string {
	return workspaceID + "\x00" + kind + "\x00" + scopeType + "\x00" + scopeID
}

func makePayloadKey(payloadType, payloadKey string) string {
	return payloadType + "\x00" + payloadKey
}
