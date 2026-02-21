package leaderelection

import (
	"context"
	"time"
)

// LeaderElector provides distributed leader election so that only one instance
// of the workspace-engine actively processes work at a time. Implementations
// must be safe for concurrent use.
type LeaderElector interface {
	// Start begins the leader election loop. It blocks until the context is
	// cancelled. Callbacks are invoked on leadership transitions.
	Start(ctx context.Context) error

	// IsLeader returns whether this instance currently holds the leadership lock.
	IsLeader() bool

	// Leader returns the identity of the current leader, or an empty string if
	// unknown.
	Leader() string

	// Resign voluntarily releases leadership. No-op if not the current leader.
	Resign()
}

// Callbacks are invoked by a LeaderElector on leadership transitions.
type Callbacks struct {
	OnStartedLeading func(ctx context.Context)
	OnStoppedLeading func()
	OnNewLeader      func(identity string)
}

// Config holds common configuration shared across implementations.
type Config struct {
	// Identity is a unique string identifying this candidate (e.g. pod name,
	// hostname, or a generated UUID).
	Identity string

	// LeaseDuration is the interval at which the leader must renew its lock.
	// Followers will wait this long before assuming the leader is gone.
	LeaseDuration time.Duration

	// RenewDeadline is the duration the acting leader will retry refreshing
	// its lock before giving up.
	RenewDeadline time.Duration

	// RetryPeriod is the interval between attempts to acquire or renew the
	// lock.
	RetryPeriod time.Duration

	// LockName is a human-readable name for the election (used as the
	// Kubernetes Lease name, Postgres advisory lock key, etc.).
	LockName string

	// Callbacks are invoked on leadership transitions. All fields are optional.
	Callbacks Callbacks
}

// Validate returns an error if the config is incomplete or inconsistent.
func (c Config) Validate() error {
	if c.Identity == "" {
		return ErrMissingIdentity
	}
	if c.LockName == "" {
		return ErrMissingLockName
	}
	if c.LeaseDuration <= 0 {
		return ErrInvalidLeaseDuration
	}
	if c.RenewDeadline <= 0 || c.RenewDeadline >= c.LeaseDuration {
		return ErrInvalidRenewDeadline
	}
	if c.RetryPeriod <= 0 || c.RetryPeriod >= c.RenewDeadline {
		return ErrInvalidRetryPeriod
	}
	return nil
}
