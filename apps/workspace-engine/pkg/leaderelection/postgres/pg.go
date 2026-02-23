package postgres

import (
	"context"
	"hash/fnv"
	"sync"
	"sync/atomic"
	"time"

	le "workspace-engine/pkg/leaderelection"

	"github.com/charmbracelet/log"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdvisoryLockElector implements LeaderElector using PostgreSQL advisory locks.
//
// Advisory locks are session-scoped: the lock is held as long as the database
// connection that acquired it remains alive. This provides automatic leader
// failover when a process crashes — the TCP connection drops and Postgres
// releases the lock.
//
// This is a good fit when all candidates already connect to the same Postgres
// instance (like workspace-engine) and no additional infrastructure is wanted.
type AdvisoryLockElector struct {
	cfg      le.Config
	pool     *pgxpool.Pool
	leader   atomic.Value // stores string
	isLeader atomic.Bool

	mu     sync.Mutex
	cancel context.CancelFunc
}

// New creates an AdvisoryLockElector backed by the given pgx pool.
func New(cfg le.Config, pool *pgxpool.Pool) (*AdvisoryLockElector, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	e := &AdvisoryLockElector{
		cfg:  cfg,
		pool: pool,
	}
	e.leader.Store("")
	return e, nil
}

// lockKey derives a stable int64 advisory-lock key from the lock name.
func lockKey(name string) int64 {
	h := fnv.New64a()
	h.Write([]byte(name))
	return int64(h.Sum64())
}

func (e *AdvisoryLockElector) Start(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	e.mu.Lock()
	e.cancel = cancel
	e.mu.Unlock()

	key := lockKey(e.cfg.LockName)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		e.runElection(ctx, key)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(e.cfg.RetryPeriod):
		}
	}
}

// runElection grabs a dedicated connection, attempts pg_try_advisory_lock, and
// if successful enters a renew loop that periodically checks the lock is still
// held.
func (e *AdvisoryLockElector) runElection(ctx context.Context, key int64) {
	conn, err := e.pool.Acquire(ctx)
	if err != nil {
		log.Error("Failed to acquire connection for leader election", "error", err)
		return
	}
	defer conn.Release()

	var acquired bool
	err = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock($1)", key).Scan(&acquired)
	if err != nil {
		log.Error("Advisory lock query failed", "error", err)
		return
	}

	if !acquired {
		if e.isLeader.Load() {
			e.stopLeading()
		}
		return
	}

	e.startLeading(ctx)

	defer func() {
		_, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", key)
		if e.isLeader.Load() {
			e.stopLeading()
		}
	}()

	ticker := time.NewTicker(e.cfg.RenewDeadline)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var alive bool
			err := conn.QueryRow(ctx, "SELECT 1").Scan(&alive)
			if err != nil {
				log.Error("Leadership health check failed", "error", err)
				return
			}
		}
	}
}

func (e *AdvisoryLockElector) startLeading(ctx context.Context) {
	e.isLeader.Store(true)
	e.leader.Store(e.cfg.Identity)
	log.Info("Acquired leadership (pg advisory lock)", "identity", e.cfg.Identity, "lock", e.cfg.LockName)
	if e.cfg.Callbacks.OnStartedLeading != nil {
		go e.cfg.Callbacks.OnStartedLeading(ctx)
	}
	if e.cfg.Callbacks.OnNewLeader != nil {
		e.cfg.Callbacks.OnNewLeader(e.cfg.Identity)
	}
}

func (e *AdvisoryLockElector) stopLeading() {
	e.isLeader.Store(false)
	log.Warn("Lost leadership (pg advisory lock)", "identity", e.cfg.Identity, "lock", e.cfg.LockName)
	if e.cfg.Callbacks.OnStoppedLeading != nil {
		e.cfg.Callbacks.OnStoppedLeading()
	}
}

func (e *AdvisoryLockElector) IsLeader() bool {
	return e.isLeader.Load()
}

func (e *AdvisoryLockElector) Leader() string {
	v, _ := e.leader.Load().(string)
	return v
}

func (e *AdvisoryLockElector) Resign() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.cancel != nil {
		e.cancel()
	}
}
