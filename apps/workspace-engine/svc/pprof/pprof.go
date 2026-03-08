package pprof

import (
	"context"
	"fmt"
	"net/http"
	_ "net/http/pprof"

	"workspace-engine/svc"

	"github.com/charmbracelet/log"
)

var _ svc.Service = (*Service)(nil)

type Service struct {
	addr   string
	server *http.Server
}

func New(addr string) *Service {
	return &Service{addr: addr}
}

func (s *Service) Name() string { return "pprof" }

func (s *Service) Start(_ context.Context) error {
	mux := http.DefaultServeMux
	s.server = &http.Server{
		Addr:    s.addr,
		Handler: mux,
	}

	go func() {
		log.Info("pprof server listening", "address", s.addr)
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("pprof ListenAndServe error", "error", err)
		}
	}()

	return nil
}

func (s *Service) Stop(ctx context.Context) error {
	if s.server == nil {
		return nil
	}
	return s.server.Shutdown(ctx)
}

func DefaultAddr(port int) string {
	return fmt.Sprintf("0.0.0.0:%d", port)
}
