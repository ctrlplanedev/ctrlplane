package claimcleanup

import (
	"context"
	"time"

	"github.com/charmbracelet/log"
	"github.com/jackc/pgx/v5/pgxpool"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/svc"
)

var _ svc.Service = (*Service)(nil)

// Service periodically releases expired claim leases on
// reconcile_work_scope so that stale rows become claimable again.
type Service struct {
	queue    *postgres.Queue
	interval time.Duration
	cancel   context.CancelFunc
	done     chan struct{}
}

func New(pool *pgxpool.Pool, interval time.Duration) *Service {
	return &Service{
		queue:    postgres.New(pool),
		interval: interval,
	}
}

func (s *Service) Name() string { return "claim-cleanup" }

func (s *Service) Start(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	s.cancel = cancel
	s.done = make(chan struct{})

	go s.run(ctx)
	return nil
}

func (s *Service) Stop(_ context.Context) error {
	if s.cancel != nil {
		s.cancel()
		<-s.done
	}
	return nil
}

func (s *Service) run(ctx context.Context) {
	defer close(s.done)

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			released, err := s.queue.CleanupExpiredClaims(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Error("claim-cleanup: failed to release expired claims", "error", err)
				continue
			}
			if released > 0 {
				log.Info("claim-cleanup: released expired claims", "count", released)
			}
		}
	}
}
