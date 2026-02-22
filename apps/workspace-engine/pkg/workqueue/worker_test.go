package workqueue

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeQueue struct {
	claimFn      func(context.Context, ClaimParams) ([]Item, error)
	extendFn     func(context.Context, ExtendLeaseParams) error
	ackFn        func(context.Context, AckSuccessParams) (AckSuccessResult, error)
	retryFn      func(context.Context, RetryParams) error
	claimCalls   atomic.Int64
	extendCalls  atomic.Int64
	ackCalls     atomic.Int64
	retryCalls   atomic.Int64
	lastClaim    ClaimParams
	lastRetry    RetryParams
	lastAck      AckSuccessParams
	lastExtend   ExtendLeaseParams
	lastClaimMux sync.Mutex
}

func (f *fakeQueue) Enqueue(ctx context.Context, params EnqueueParams) error { return nil }
func (f *fakeQueue) Claim(ctx context.Context, params ClaimParams) ([]Item, error) {
	f.claimCalls.Add(1)
	f.lastClaimMux.Lock()
	f.lastClaim = params
	f.lastClaimMux.Unlock()
	if f.claimFn != nil {
		return f.claimFn(ctx, params)
	}
	return nil, nil
}
func (f *fakeQueue) ExtendLease(ctx context.Context, params ExtendLeaseParams) error {
	f.extendCalls.Add(1)
	f.lastClaimMux.Lock()
	f.lastExtend = params
	f.lastClaimMux.Unlock()
	if f.extendFn != nil {
		return f.extendFn(ctx, params)
	}
	return nil
}
func (f *fakeQueue) AckSuccess(ctx context.Context, params AckSuccessParams) (AckSuccessResult, error) {
	f.ackCalls.Add(1)
	f.lastClaimMux.Lock()
	f.lastAck = params
	f.lastClaimMux.Unlock()
	if f.ackFn != nil {
		return f.ackFn(ctx, params)
	}
	return AckSuccessResult{Deleted: true}, nil
}
func (f *fakeQueue) Retry(ctx context.Context, params RetryParams) error {
	f.retryCalls.Add(1)
	f.lastClaimMux.Lock()
	f.lastRetry = params
	f.lastClaimMux.Unlock()
	if f.retryFn != nil {
		return f.retryFn(ctx, params)
	}
	return nil
}

type fakeProcessor struct {
	fn func(context.Context, Item) error
}

func (f fakeProcessor) Process(ctx context.Context, item Item) error {
	if f.fn != nil {
		return f.fn(ctx, item)
	}
	return nil
}

func validConfig() NodeConfig {
	return NodeConfig{
		WorkerID:       "worker-1",
		BatchSize:      2,
		PollInterval:   5 * time.Millisecond,
		LeaseDuration:  60 * time.Millisecond,
		LeaseHeartbeat: 10 * time.Millisecond,
		MaxConcurrency: 2,
	}
}

func TestNodeConfigValidate(t *testing.T) {
	base := validConfig()
	tests := []struct {
		name string
		cfg  NodeConfig
		err  error
	}{
		{name: "ok", cfg: base, err: nil},
		{name: "missing worker id", cfg: NodeConfig{}, err: ErrMissingWorkerID},
		{name: "invalid batch", cfg: func() NodeConfig { c := base; c.BatchSize = 0; return c }(), err: ErrInvalidBatchSize},
		{name: "invalid poll", cfg: func() NodeConfig { c := base; c.PollInterval = 0; return c }(), err: ErrInvalidPollInterval},
		{name: "invalid lease", cfg: func() NodeConfig { c := base; c.LeaseDuration = 0; return c }(), err: ErrInvalidLeaseDuration},
		{name: "invalid heartbeat zero", cfg: func() NodeConfig { c := base; c.LeaseHeartbeat = 0; return c }(), err: ErrInvalidLeaseHeartbeat},
		{name: "invalid heartbeat gte lease", cfg: func() NodeConfig { c := base; c.LeaseHeartbeat = c.LeaseDuration; return c }(), err: ErrInvalidLeaseHeartbeat},
		{name: "invalid concurrency", cfg: func() NodeConfig { c := base; c.MaxConcurrency = 0; return c }(), err: ErrInvalidMaxConcurrency},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if !errors.Is(err, tt.err) {
				t.Fatalf("expected %v, got %v", tt.err, err)
			}
		})
	}
}

func TestNewWorkerAndIdentity(t *testing.T) {
	cfg := validConfig()
	if _, err := NewWorker("workqueue-worker", nil, fakeProcessor{}, cfg); err == nil {
		t.Fatal("expected nil queue error")
	}
	if _, err := NewWorker("workqueue-worker", &fakeQueue{}, nil, cfg); err == nil {
		t.Fatal("expected nil processor error")
	}
	if _, err := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, NodeConfig{}); !errors.Is(err, ErrMissingWorkerID) {
		t.Fatalf("expected config validation error, got %v", err)
	}

	w, err := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, cfg)
	if err != nil {
		t.Fatalf("new worker: %v", err)
	}
	if w.ID() != cfg.WorkerID {
		t.Fatalf("unexpected worker id: %s", w.ID())
	}
	if w.Name() != "workqueue-worker" {
		t.Fatalf("unexpected worker name: %s", w.Name())
	}
}

func TestStartStopAndStopBranches(t *testing.T) {
	cfg := validConfig()
	q := &fakeQueue{}
	w, err := NewWorker("workqueue-worker", q, fakeProcessor{}, cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := w.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	// Start twice should no-op.
	if err := w.Start(ctx); err != nil {
		t.Fatalf("start twice: %v", err)
	}
	if err := w.Stop(context.Background()); err != nil {
		t.Fatalf("stop: %v", err)
	}
	// Stop when not started should no-op.
	if err := w.Stop(context.Background()); err != nil {
		t.Fatalf("stop not started: %v", err)
	}

	// Branch: done returns non-cancel error.
	w2, _ := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, cfg)
	w2.cancel = func() {}
	w2.done = make(chan error, 1)
	w2.done <- errors.New("boom")
	close(w2.done)
	if err := w2.Stop(context.Background()); err == nil || err.Error() != "boom" {
		t.Fatalf("expected boom error, got %v", err)
	}

	// Branch: stop timeout context.
	w3, _ := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, cfg)
	w3.cancel = func() {}
	w3.done = make(chan error)
	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer timeoutCancel()
	if err := w3.Stop(timeoutCtx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded, got %v", err)
	}
}

func TestRunClaimErrorContinues(t *testing.T) {
	cfg := validConfig()
	cfg.PollInterval = 1 * time.Millisecond
	q := &fakeQueue{
		claimFn: func(context.Context, ClaimParams) ([]Item, error) {
			return nil, errors.New("temporary claim error")
		},
	}
	w, _ := NewWorker("workqueue-worker", q, fakeProcessor{}, cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Millisecond)
	defer cancel()
	err := w.Run(ctx)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected context deadline exceeded, got %v", err)
	}
	if q.claimCalls.Load() < 2 {
		t.Fatalf("expected multiple claim attempts, got %d", q.claimCalls.Load())
	}
}

func TestRunSuccessPathAndHooks(t *testing.T) {
	cfg := validConfig()
	cfg.BatchSize = 1
	cfg.MaxConcurrency = 1
	cfg.PollInterval = 1 * time.Millisecond
	cfg.LeaseDuration = 40 * time.Millisecond
	cfg.LeaseHeartbeat = 5 * time.Millisecond

	var started, stopped, claimed, processed, leaseExtended atomic.Int64
	processedCh := make(chan struct{}, 1)
	cfg.Hooks = Hooks{
		OnStarted: func(context.Context, string) { started.Add(1) },
		OnStopped: func(string) { stopped.Add(1) },
		OnClaimed: func(Item) { claimed.Add(1) },
		OnProcessed: func(Item) {
			processed.Add(1)
			select {
			case processedCh <- struct{}{}:
			default:
			}
		},
		OnLeaseExtended: func(int64) { leaseExtended.Add(1) },
	}

	first := atomic.Bool{}
	q := &fakeQueue{
		claimFn: func(context.Context, ClaimParams) ([]Item, error) {
			if !first.Swap(true) {
				return []Item{{ID: 1, AttemptCount: 2, UpdatedAt: time.Now()}}, nil
			}
			return nil, nil
		},
	}
	p := fakeProcessor{
		fn: func(context.Context, Item) error {
			time.Sleep(12 * time.Millisecond) // allow at least one lease heartbeat tick
			return nil
		},
	}
	w, _ := NewWorker("workqueue-worker", q, p, cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()

	select {
	case <-processedCh:
		cancel()
	case <-time.After(200 * time.Millisecond):
		t.Fatal("timed out waiting for processed hook")
	}

	err := <-done
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled run, got %v", err)
	}

	if started.Load() == 0 || stopped.Load() == 0 || claimed.Load() == 0 || processed.Load() == 0 {
		t.Fatalf("expected lifecycle hooks to be called: started=%d stopped=%d claimed=%d processed=%d",
			started.Load(), stopped.Load(), claimed.Load(), processed.Load())
	}
	if q.ackCalls.Load() != 1 {
		t.Fatalf("expected one ack call, got %d", q.ackCalls.Load())
	}
	if leaseExtended.Load() == 0 {
		t.Fatal("expected lease extension hook to be called at least once")
	}
}

func TestRunDrainInflightOnCancel(t *testing.T) {
	cfg := validConfig()
	cfg.BatchSize = 1
	cfg.MaxConcurrency = 1
	cfg.PollInterval = 1 * time.Millisecond

	first := atomic.Bool{}
	release := make(chan struct{})
	q := &fakeQueue{
		claimFn: func(context.Context, ClaimParams) ([]Item, error) {
			if !first.Swap(true) {
				return []Item{{ID: 9, UpdatedAt: time.Now()}}, nil
			}
			return nil, nil
		},
	}
	p := fakeProcessor{
		fn: func(ctx context.Context, item Item) error {
			<-release
			return nil
		},
	}
	w, _ := NewWorker("workqueue-worker", q, p, cfg)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()

	// Give worker time to claim and start in-flight processing.
	time.Sleep(10 * time.Millisecond)
	cancel()
	go func() {
		time.Sleep(10 * time.Millisecond)
		close(release)
	}()

	err := <-done
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled, got %v", err)
	}
}

func TestProcessClaimedItemBranches(t *testing.T) {
	cfg := validConfig()
	item := Item{ID: 7, AttemptCount: 1, UpdatedAt: time.Now()}

	t.Run("process error retries successfully", func(t *testing.T) {
		var retried atomic.Int64
		cfg1 := cfg
		cfg1.Hooks.OnRetried = func(Item, error) { retried.Add(1) }
		w, _ := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{fn: func(context.Context, Item) error { return errors.New("fail") }}, cfg1)
		w.processClaimedItem(context.Background(), item)
		if retried.Load() != 1 {
			t.Fatalf("expected retried hook once, got %d", retried.Load())
		}
	})

	t.Run("process error retry fails drops", func(t *testing.T) {
		var dropped atomic.Int64
		cfg2 := cfg
		cfg2.Hooks.OnDropped = func(Item, error) { dropped.Add(1) }
		q := &fakeQueue{retryFn: func(context.Context, RetryParams) error { return errors.New("retry failed") }}
		w, _ := NewWorker("workqueue-worker", q, fakeProcessor{fn: func(context.Context, Item) error { return errors.New("fail") }}, cfg2)
		w.processClaimedItem(context.Background(), item)
		if dropped.Load() != 1 {
			t.Fatalf("expected dropped hook once, got %d", dropped.Load())
		}
	})

	t.Run("ack failure drops", func(t *testing.T) {
		var dropped atomic.Int64
		cfg3 := cfg
		cfg3.Hooks.OnDropped = func(Item, error) { dropped.Add(1) }
		q := &fakeQueue{ackFn: func(context.Context, AckSuccessParams) (AckSuccessResult, error) {
			return AckSuccessResult{}, errors.New("ack failed")
		}}
		w, _ := NewWorker("workqueue-worker", q, fakeProcessor{}, cfg3)
		w.processClaimedItem(context.Background(), item)
		if dropped.Load() != 1 {
			t.Fatalf("expected dropped hook once, got %d", dropped.Load())
		}
	})
}

func TestRetryBackoff(t *testing.T) {
	w, _ := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, validConfig())

	if got := w.retryBackoff(-1); got != time.Second {
		t.Fatalf("expected 1s for negative attempts, got %s", got)
	}
	if got := w.retryBackoff(2); got != 4*time.Second {
		t.Fatalf("expected 4s for attempt=2, got %s", got)
	}

	// default cap is 5m
	if got := w.retryBackoff(20); got != defaultRetryBackoffCap {
		t.Fatalf("expected default cap %s, got %s", defaultRetryBackoffCap, got)
	}

	cfg := validConfig()
	cfg.MaxRetryBackoff = 3 * time.Second
	w2, _ := NewWorker("workqueue-worker", &fakeQueue{}, fakeProcessor{}, cfg)
	if got := w2.retryBackoff(4); got != 3*time.Second {
		t.Fatalf("expected custom cap 3s, got %s", got)
	}
}
