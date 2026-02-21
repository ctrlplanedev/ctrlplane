package workspaceticker

import (
	"context"
	"time"

	"workspace-engine/pkg/events/handler/tick"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/workspace/manager"
	svc "workspace-engine/svc"
	"workspace-engine/svc/workspaceticker/tickerloop"

	"github.com/charmbracelet/log"
)

var _ svc.Service = (*Service)(nil)

// Service periodically sends workspace tick events via the Kafka producer.
type Service struct {
	producer messaging.Producer
	interval time.Duration
}

func New(producer messaging.Producer, opts ...Option) *Service {
	s := &Service{
		producer: producer,
		interval: time.Minute,
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

type Option func(*Service)

func WithInterval(d time.Duration) Option {
	return func(s *Service) { s.interval = d }
}

func (s *Service) Name() string { return "workspace-ticker" }

func (s *Service) Start(ctx context.Context) error {
	go tickerloop.Every(ctx, s.interval, func(ctx context.Context) {
		ids := manager.Workspaces().Keys()
		log.Info("Sending workspace ticks", "count", len(ids))
		for _, id := range ids {
			if err := tick.SendWorkspaceTick(ctx, s.producer, id); err != nil {
				log.Error("Failed to send workspace tick", "error", err)
			}
		}
	})
	return nil
}

// Stop is a no-op — context cancellation stops the ticker goroutine.
func (s *Service) Stop(_ context.Context) error { return nil }
