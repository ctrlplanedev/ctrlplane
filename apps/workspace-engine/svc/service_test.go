package svc

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockService struct {
	name      string
	startErr  error
	stopErr   error
	startedAt atomic.Int64
	stoppedAt atomic.Int64
	started   atomic.Bool
	stopped   atomic.Bool
}

func newMock(name string) *mockService { return &mockService{name: name} }

func (m *mockService) Name() string { return m.name }

func (m *mockService) Start(_ context.Context) error {
	if m.startErr != nil {
		return m.startErr
	}
	m.startedAt.Store(time.Now().UnixNano())
	m.started.Store(true)
	return nil
}

func (m *mockService) Stop(_ context.Context) error {
	m.stoppedAt.Store(time.Now().UnixNano())
	m.stopped.Store(true)
	return m.stopErr
}

func TestNewRunner_Defaults(t *testing.T) {
	r := NewRunner()
	assert.Equal(t, 10*time.Second, r.shutdownTimeout)
	assert.Empty(t, r.services)
}

func TestNewRunner_WithShutdownTimeout(t *testing.T) {
	r := NewRunner(WithShutdownTimeout(30 * time.Second))
	assert.Equal(t, 30*time.Second, r.shutdownTimeout)
}

func TestRunner_Add(t *testing.T) {
	r := NewRunner()
	a := newMock("a")
	b := newMock("b")
	r.Add(a, b)
	assert.Len(t, r.services, 2)

	c := newMock("c")
	r.Add(c)
	assert.Len(t, r.services, 3)
}

func TestRunner_StartsAllServices(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	a := newMock("a")
	b := newMock("b")
	c := newMock("c")

	r := NewRunner(WithShutdownTimeout(time.Second))
	r.Add(a, b, c)

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := r.Run(ctx)
	require.NoError(t, err)

	assert.True(t, a.started.Load())
	assert.True(t, b.started.Load())
	assert.True(t, c.started.Load())
}

func TestRunner_StopsAllServicesOnContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	a := newMock("a")
	b := newMock("b")

	r := NewRunner(WithShutdownTimeout(time.Second))
	r.Add(a, b)

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := r.Run(ctx)
	require.NoError(t, err)

	assert.True(t, a.stopped.Load())
	assert.True(t, b.stopped.Load())
}

func TestRunner_StartErrorStopsEarly(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	a := newMock("a")
	b := newMock("b")
	b.startErr = errors.New("boot failure")
	c := newMock("c")

	r := NewRunner(WithShutdownTimeout(time.Second))
	r.Add(a, b, c)

	err := r.Run(ctx)
	require.Error(t, err)
	assert.Equal(t, "boot failure", err.Error())

	assert.True(t, a.started.Load(), "a should have started before b failed")
	assert.False(t, b.started.Load(), "b's Start returned an error so started flag stays false")
	assert.False(t, c.started.Load(), "c should not have been started")
}

func TestRunner_StopErrorsAreSwallowed(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	a := newMock("a")
	a.stopErr = errors.New("stop failed")
	b := newMock("b")

	r := NewRunner(WithShutdownTimeout(time.Second))
	r.Add(a, b)

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := r.Run(ctx)
	require.NoError(t, err, "stop errors should not propagate from Run")

	assert.True(t, a.stopped.Load())
	assert.True(t, b.stopped.Load())
}

func TestRunner_ServicesStartInOrder(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	var mu sync.Mutex
	var order []string

	makeService := func(name string) *orderedMock {
		return &orderedMock{
			name:  name,
			mu:    &mu,
			order: &order,
		}
	}

	a := makeService("a")
	b := makeService("b")
	c := makeService("c")

	r := NewRunner(WithShutdownTimeout(time.Second))
	r.Add(a, b, c)

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := r.Run(ctx)
	require.NoError(t, err)

	mu.Lock()
	defer mu.Unlock()

	require.Len(t, order, 6, "expected 3 starts + 3 stops")
	assert.Equal(t, "start:a", order[0])
	assert.Equal(t, "start:b", order[1])
	assert.Equal(t, "start:c", order[2])
}

type orderedMock struct {
	name  string
	mu    *sync.Mutex
	order *[]string
}

func (m *orderedMock) Name() string { return m.name }
func (m *orderedMock) Start(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	*m.order = append(*m.order, "start:"+m.name)
	return nil
}
func (m *orderedMock) Stop(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	*m.order = append(*m.order, "stop:"+m.name)
	return nil
}

func TestRunner_RunWithNoServices(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	r := NewRunner(WithShutdownTimeout(time.Second))

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := r.Run(ctx)
	require.NoError(t, err)
}
