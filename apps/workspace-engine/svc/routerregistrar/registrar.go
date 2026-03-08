package routerregistrar

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/svc"
	"workspace-engine/svc/routerregistrar/registry"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

var _ svc.Service = (*Service)(nil)

// Service registers this workspace-engine instance with the router so that
// incoming HTTP requests are hash-routed to the correct pod based on the
// Kafka partitions it owns.
type Service struct {
	cfg      config.Config
	consumer messaging.Consumer
	client   *registry.Client
}

func New(cfg config.Config, consumer messaging.Consumer) *Service {
	return &Service{cfg: cfg, consumer: consumer}
}

func (s *Service) Name() string { return "router-registrar" }

func (s *Service) Start(ctx context.Context) error {
	if s.cfg.RouterURL == "" {
		return nil
	}

	workerID := uuid.New().String()
	s.client = registry.NewClient(s.cfg.RouterURL, workerID)

	assignedPartitions, err := s.consumer.GetAssignedPartitions()
	if err != nil || len(assignedPartitions) == 0 {
		log.Warn("No assigned partitions for router registration", "error", err, "partitions", assignedPartitions)
		return nil
	}

	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	httpAddress := fmt.Sprintf("http://%s", addr)
	if s.cfg.RegisterAddress != "" {
		httpAddress = s.cfg.RegisterAddress
	}

	log.Info("Registering with router", "http_address", httpAddress, "partitions", assignedPartitions)
	for attempt := 1; ; attempt++ {
		if err := s.client.Register(ctx, httpAddress, assignedPartitions); err != nil {
			backoff := time.Duration(min(attempt, 30)) * time.Second
			log.Error("Failed to register with router, retrying", "error", err, "attempt", attempt, "backoff", backoff)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				continue
			}
		}
		break
	}
	log.Info("Successfully registered with router", "http_address", httpAddress, "partitions", assignedPartitions)

	go s.client.StartHeartbeat(ctx, 15*time.Second)
	return nil
}

func (s *Service) Stop(ctx context.Context) error {
	if s.client == nil {
		return nil
	}
	if err := s.client.Unregister(ctx); err != nil {
		log.Warn("Failed to unregister from router", "error", err)
	}
	return nil
}
