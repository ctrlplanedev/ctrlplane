package http

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"workspace-engine/pkg/config"
	"workspace-engine/svc"
	"workspace-engine/svc/http/server"
)

var _ svc.Service = (*Service)(nil)

// Service wraps the workspace-engine HTTP server as a service.Service.
type Service struct {
	cfg        config.Config
	pool       *pgxpool.Pool
	httpServer *http.Server
}

func New(cfg config.Config, pool *pgxpool.Pool) *Service {
	return &Service{cfg: cfg, pool: pool}
}

func (s *Service) Name() string { return "http" }

func (s *Service) Start(_ context.Context) error {
	srv := server.New(s.pool)
	router := srv.SetupRouter()

	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		slog.Info("HTTP server listening", "address", addr)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP ListenAndServe error", "error", err)
			os.Exit(1)
		}
	}()

	return nil
}

func (s *Service) Stop(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}
	return s.httpServer.Shutdown(ctx)
}
