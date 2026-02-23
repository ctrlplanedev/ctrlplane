package workqueue

import (
	"context"
	"time"
)

// Queue defines storage/coordination operations used by worker nodes.
// Implementations must be safe for concurrent use.
type Queue interface {
	Enqueue(ctx context.Context, params EnqueueParams) error
	Claim(ctx context.Context, params ClaimParams) ([]Item, error)
	ExtendLease(ctx context.Context, params ExtendLeaseParams) error
	AckSuccess(ctx context.Context, params AckSuccessParams) (AckSuccessResult, error)
	Retry(ctx context.Context, params RetryParams) error
}

// Processor handles claimed work items.
type Processor interface {
	Process(ctx context.Context, item Item) error
}

// Hooks are optional callbacks for worker lifecycle and item-level transitions.
type Hooks struct {
	OnStarted       func(ctx context.Context, workerID string)
	OnStopped       func(workerID string)
	OnClaimed       func(item Item)
	OnProcessed     func(item Item)
	OnRetried       func(item Item, err error)
	OnDropped       func(item Item, err error)
	OnLeaseExtended func(itemID int64)
}

// NodeConfig configures a worker node loop.
type NodeConfig struct {
	WorkerID        string
	BatchSize       int
	PollInterval    time.Duration
	LeaseDuration   time.Duration
	LeaseHeartbeat  time.Duration
	MaxConcurrency  int
	MaxRetryBackoff time.Duration
	Hooks           Hooks
}

// Validate returns an error if the config is incomplete or inconsistent.
func (c NodeConfig) Validate() error {
	if c.WorkerID == "" {
		return ErrMissingWorkerID
	}
	if c.BatchSize <= 0 {
		return ErrInvalidBatchSize
	}
	if c.PollInterval <= 0 {
		return ErrInvalidPollInterval
	}
	if c.LeaseDuration <= 0 {
		return ErrInvalidLeaseDuration
	}
	if c.LeaseHeartbeat <= 0 || c.LeaseHeartbeat >= c.LeaseDuration {
		return ErrInvalidLeaseHeartbeat
	}
	if c.MaxConcurrency <= 0 {
		return ErrInvalidMaxConcurrency
	}
	return nil
}

// Node defines the full worker node contract: boot, poll/claim, process, and
// settle items until shutdown.
type Node interface {
	Run(ctx context.Context) error
	ID() string
}

type EnqueueParams struct {
	WorkspaceID string
	Kind        string
	ScopeType   string
	ScopeID     string
	EventTS     time.Time
	Priority    int16
	NotBefore   time.Time
}

type ClaimParams struct {
	BatchSize     int
	WorkerID      string
	LeaseDuration time.Duration
}

type ExtendLeaseParams struct {
	ItemID        int64
	WorkerID      string
	LeaseDuration time.Duration
}

type AckSuccessParams struct {
	ItemID           int64
	WorkerID         string
	ClaimedUpdatedAt time.Time
}

type AckSuccessResult struct {
	Deleted bool
}

type RetryParams struct {
	ItemID       int64
	WorkerID     string
	LastError    string
	RetryBackoff time.Duration
}

type Item struct {
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
