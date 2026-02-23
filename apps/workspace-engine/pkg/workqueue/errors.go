package workqueue

import "errors"

var (
	ErrMissingWorkspaceID    = errors.New("workqueue: workspace_id must not be empty")
	ErrMissingKind           = errors.New("workqueue: kind must not be empty")
	ErrMissingWorkerID       = errors.New("workqueue: worker_id must not be empty")
	ErrInvalidBatchSize      = errors.New("workqueue: batch size must be positive")
	ErrInvalidPollInterval   = errors.New("workqueue: poll interval must be positive")
	ErrInvalidLeaseDuration  = errors.New("workqueue: lease duration must be positive")
	ErrInvalidLeaseHeartbeat = errors.New("workqueue: lease heartbeat must be positive and less than lease duration")
	ErrInvalidMaxConcurrency = errors.New("workqueue: max concurrency must be positive")
	ErrInvalidRetryBackoff   = errors.New("workqueue: retry backoff must be positive")
	ErrClaimNotOwned         = errors.New("workqueue: item is not currently claimed by worker")
)
