package http

import (
	"context"
	"fmt"
	"net/http"

	"workspace-engine/pkg/config"
	"workspace-engine/svc"
	"workspace-engine/svc/http/server"

	"github.com/charmbracelet/log"
)

var _ svc.Service = (*Service)(nil)

// Service wraps the workspace-engine HTTP server as a service.Service.
type Service struct {
	cfg        config.Config
	httpServer *http.Server
}

func New(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) Name() string { return "http" }

func (s *Service) Start(_ context.Context) error {
	srv := server.New()
	router := srv.SetupRouter()

	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		log.Info("HTTP server listening", "address", addr)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP ListenAndServe error", "error", err)
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
