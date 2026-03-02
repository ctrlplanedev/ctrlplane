package reconcile

import (
	"context"
	"fmt"
	"sync"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"
)

const (
	defaultRetryBackoffCap = 5 * time.Minute
)

var _ svc.Service = (*Worker)(nil)
var _ Node = (*Worker)(nil)

// Worker is the default node runtime implementation. It continuously polls the
// queue, claims items, processes them with bounded concurrency, heartbeats
// active item leases, and settles each item with ack/retry semantics.
type Worker struct {
	name      string
	queue     Queue
	processor Processor
	cfg       NodeConfig

	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan error
}

func NewWorker(name string, queue Queue, processor Processor, cfg NodeConfig) (*Worker, error) {
	if queue == nil {
		return nil, fmt.Errorf("workqueue: queue must not be nil")
	}
	if processor == nil {
		return nil, fmt.Errorf("workqueue: processor must not be nil")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if name == "" {
		name = "workqueue-worker"
	}
	return &Worker{
		name:      name,
		queue:     queue,
		processor: processor,
		cfg:       cfg,
	}, nil
}

func (w *Worker) ID() string {
	return w.cfg.WorkerID
}

func (w *Worker) Name() string {
	return w.name
}

func (w *Worker) Start(ctx context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.cancel != nil {
		return nil
	}

	runCtx, cancel := context.WithCancel(ctx)
	done := make(chan error, 1)

	w.cancel = cancel
	w.done = done

	go func() {
		done <- w.Run(runCtx)
		close(done)
	}()

	return nil
}

func (w *Worker) Stop(ctx context.Context) error {
	w.mu.Lock()
	cancel := w.cancel
	done := w.done
	w.cancel = nil
	w.done = nil
	w.mu.Unlock()

	if cancel == nil || done == nil {
		return nil
	}

	cancel()

	select {
	case err, ok := <-done:
		if !ok || err == nil || err == context.Canceled {
			return nil
		}
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (w *Worker) Run(ctx context.Context) error {
	if w.cfg.Hooks.OnStarted != nil {
		w.cfg.Hooks.OnStarted(ctx, w.cfg.WorkerID)
	}
	defer func() {
		if w.cfg.Hooks.OnStopped != nil {
			w.cfg.Hooks.OnStopped(w.cfg.WorkerID)
		}
	}()

	sem := make(chan struct{}, w.cfg.MaxConcurrency)
	doneCh := make(chan struct{}, w.cfg.MaxConcurrency)
	for {
		availableSlots := w.cfg.MaxConcurrency - len(sem)
		if availableSlots > 0 {
			claimSize := min(w.cfg.BatchSize, availableSlots)
			items, err := w.queue.Claim(ctx, ClaimParams{
				BatchSize:     claimSize,
				WorkerID:      w.cfg.WorkerID,
				LeaseDuration: w.cfg.LeaseDuration,
			})
			if err != nil {
				log.Error("error claiming items", "error", err)
			}
			for _, item := range items {
				log.Info("item", "item", item.ID, "kind", item.Kind, "scopeType", item.ScopeType, "scopeID", item.ScopeID)
			}
			if err == nil && len(items) > 0 {
				w.startItems(ctx, items, sem, doneCh)
				// If we filled all currently available slots, immediately loop to try
				// to top up remaining capacity instead of sleeping.
				if len(items) == claimSize {
					continue
				}
			}
		}

		select {
		case <-ctx.Done():
			// Drain in-flight workers on shutdown.
			for len(sem) > 0 {
				<-doneCh
			}
			return ctx.Err()
		case <-doneCh:
			// A worker finished; loop will attempt to claim more work immediately.
		case <-time.After(w.cfg.PollInterval):
			// No completed workers and no immediate work; poll again.
		}
	}
}

func (w *Worker) startItems(ctx context.Context, items []Item, sem chan struct{}, doneCh chan struct{}) {
	for _, item := range items {
		if w.cfg.Hooks.OnClaimed != nil {
			w.cfg.Hooks.OnClaimed(item)
		}
		sem <- struct{}{}
		go func() {
			defer func() { <-sem }()
			defer func() { doneCh <- struct{}{} }()
			w.processClaimedItem(ctx, item)
		}()
	}
}

func (w *Worker) processClaimedItem(ctx context.Context, item Item) {
	leaseCtx, stopLease := context.WithCancel(ctx)
	var leaseWG sync.WaitGroup
	leaseWG.Go(func() {
		ticker := time.NewTicker(w.cfg.LeaseHeartbeat)
		defer ticker.Stop()
		for {
			select {
			case <-leaseCtx.Done():
				return
			case <-ticker.C:
				err := w.queue.ExtendLease(ctx, ExtendLeaseParams{
					ItemID:        item.ID,
					WorkerID:      w.cfg.WorkerID,
					LeaseDuration: w.cfg.LeaseDuration,
				})
				if err == nil && w.cfg.Hooks.OnLeaseExtended != nil {
					w.cfg.Hooks.OnLeaseExtended(item.ID)
				}
			}
		}
	})

	result, processErr := w.processor.Process(ctx, item)
	stopLease()
	leaseWG.Wait()

	if processErr != nil {
		log.Error("Error processing item", "item", item.ID, "scopeType", item.ScopeType, "scopeID", item.ScopeID, "error", processErr)
		retryErr := w.queue.Retry(ctx, RetryParams{
			ItemID:       item.ID,
			WorkerID:     w.cfg.WorkerID,
			LastError:    processErr.Error(),
			RetryBackoff: w.retryBackoff(item.AttemptCount),
		})
		if retryErr != nil {
			if w.cfg.Hooks.OnDropped != nil {
				w.cfg.Hooks.OnDropped(item, retryErr)
			}
			return
		}
		if w.cfg.Hooks.OnRetried != nil {
			w.cfg.Hooks.OnRetried(item, processErr)
		}
		return
	}

	if result.RequeueAfter > 0 {
		requeueErr := w.queue.Enqueue(ctx, EnqueueParams{
			WorkspaceID: item.WorkspaceID,
			Kind:        item.Kind,
			ScopeType:   item.ScopeType,
			ScopeID:     item.ScopeID,
			EventTS:     time.Now(),
			Priority:    item.Priority,
			NotBefore:   time.Now().Add(result.RequeueAfter),
		})
		if requeueErr != nil {
			if w.cfg.Hooks.OnDropped != nil {
				w.cfg.Hooks.OnDropped(item, requeueErr)
			}
		}
	}

	_, ackErr := w.queue.AckSuccess(ctx, AckSuccessParams{
		ItemID:           item.ID,
		WorkerID:         w.cfg.WorkerID,
		ClaimedUpdatedAt: item.UpdatedAt,
	})
	if ackErr != nil {
		if w.cfg.Hooks.OnDropped != nil {
			w.cfg.Hooks.OnDropped(item, ackErr)
		}
		return
	}
	if w.cfg.Hooks.OnProcessed != nil {
		w.cfg.Hooks.OnProcessed(item)
	}
}

func (w *Worker) retryBackoff(attemptCount int32) time.Duration {
	exp := min(max(int(attemptCount), 0), 16)
	backoff := time.Second * time.Duration(1<<exp)

	max := w.cfg.MaxRetryBackoff
	if max <= 0 {
		max = defaultRetryBackoffCap
	}
	if backoff > max {
		return max
	}
	return backoff
}
