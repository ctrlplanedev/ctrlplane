package reconcile

import (
	"errors"
	"fmt"
)

var (
	ErrMissingWorkspaceID    = errors.New("workqueue: workspace_id must not be empty")
	ErrMissingKind           = errors.New("workqueue: kind must not be empty")
	ErrMissingWorkerID       = errors.New("workqueue: worker_id must not be empty")
	ErrInvalidBatchSize      = errors.New("workqueue: batch size must be positive")
	ErrInvalidPollInterval   = errors.New("workqueue: poll interval must be positive")
	ErrInvalidLeaseDuration  = errors.New("workqueue: lease duration must be positive")
	ErrInvalidLeaseHeartbeat = errors.New(
		"workqueue: lease heartbeat must be positive and less than lease duration",
	)
	ErrInvalidMaxConcurrency = errors.New("workqueue: max concurrency must be positive")
	ErrInvalidRetryBackoff   = errors.New("workqueue: retry backoff must be positive")
	ErrClaimNotOwned         = errors.New("workqueue: item is not currently claimed by worker")
)

// Error is the typed error contract returned by processors. The dispatcher
// fills in Type and NonRetryable based on its domain knowledge; the worker
// reads NonRetryable to decide whether to retry or permanently fail the item.
//
// Type is an opaque string chosen by the emitting package (e.g.
// "argo.TemplateRenderError"). It is recorded on the work item for diagnostics
// and surfaced to dashboards/alerts.
type Error struct {
	Type         string
	NonRetryable bool
	Cause        error
}

func (e *Error) Error() string {
	if e.Cause == nil {
		return e.Type
	}
	return fmt.Sprintf("%s: %v", e.Type, e.Cause)
}

func (e *Error) Unwrap() error {
	return e.Cause
}

func NonRetryable(typ string, cause error) *Error {
	return &Error{Type: typ, NonRetryable: true, Cause: cause}
}

func Retryable(typ string, cause error) *Error {
	return &Error{Type: typ, NonRetryable: false, Cause: cause}
}

func IsNonRetryable(err error) bool {
	var rerr *Error
	return errors.As(err, &rerr) && rerr.NonRetryable
}

func ErrorType(err error) string {
	var rerr *Error
	if errors.As(err, &rerr) {
		return rerr.Type
	}
	return ""
}
