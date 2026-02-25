package svc

import (
	"context"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/charmbracelet/log"
)

// Service represents a long-running subsystem of the workspace-engine (HTTP
// server, Kafka consumer, cron ticker, router registration, etc.). Each
// service owns its own goroutines and resources.
type Service interface {
	// Name returns a short human-readable label used in log messages.
	Name() string

	// Start begins the service. It may spawn goroutines but must not block
	// forever — return once the service is running. The provided context is
	// cancelled when the application is shutting down; services should use it
	// to stop background work.
	Start(ctx context.Context) error

	// Stop performs a graceful shutdown. The context carries a deadline after
	// which the caller will abandon waiting.
	Stop(ctx context.Context) error
}

// Runner manages the lifecycle of a set of services: start them all, wait for
// a termination signal, then stop them in reverse order.
type Runner struct {
	services        []Service
	shutdownTimeout time.Duration
}

func NewRunner(opts ...RunnerOption) *Runner {
	r := &Runner{shutdownTimeout: 10 * time.Second}
	for _, o := range opts {
		o(r)
	}
	return r
}

type RunnerOption func(*Runner)

func WithShutdownTimeout(d time.Duration) RunnerOption {
	return func(r *Runner) { r.shutdownTimeout = d }
}

// Add appends one or more services to the runner.
func (r *Runner) Add(svc ...Service) {
	r.services = append(r.services, svc...)
}

// Run starts all registered services, blocks until SIGINT/SIGTERM, then stops
// services in reverse order. It returns the first error encountered during
// startup; shutdown errors are logged but not returned.
func (r *Runner) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	for _, svc := range r.services {
		log.Info("Starting service", "service", svc.Name())
		if err := svc.Start(ctx); err != nil {
			cancel()
			return err
		}
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigChan:
		log.Warn("Received signal, shutting down", "signal", sig)
	case <-ctx.Done():
		log.Warn("Context cancelled, shutting down")
	}

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), r.shutdownTimeout)
	defer shutdownCancel()

	var wg sync.WaitGroup
	for i := len(r.services) - 1; i >= 0; i-- {
		svc := r.services[i]
		wg.Go(func() {
			log.Info("Stopping service", "service", svc.Name())
			if err := svc.Stop(shutdownCtx); err != nil {
				log.Error("Service stop error", "service", svc.Name(), "error", err)
			}
		})
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Info("All services stopped")
	case <-shutdownCtx.Done():
		log.Warn("Shutdown timeout exceeded, forcing exit")
	}

	return nil
}
