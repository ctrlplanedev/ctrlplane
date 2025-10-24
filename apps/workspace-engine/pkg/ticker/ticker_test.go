package ticker

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/workspace"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockEventProducer mocks the Kafka producer for testing
type MockEventProducer struct {
	mock.Mock
}

func (m *MockEventProducer) ProduceEvent(eventType string, workspaceID string, data any) error {
	args := m.Called(eventType, workspaceID, data)
	return args.Error(0)
}

func (m *MockEventProducer) Flush(timeoutMs int) int {
	args := m.Called(timeoutMs)
	return args.Int(0)
}

func (m *MockEventProducer) Close() {
	m.Called()
}

func TestEmitTicks_NoWorkspaces(t *testing.T) {
	mockProducer := new(MockEventProducer)
	ticker := &Ticker{
		producer:  mockProducer,
		interval:  time.Minute,
		eventType: WorkspaceTickEventType,
	}

	// Ensure no workspaces are registered
	// (in real usage, workspace registry would be empty)

	err := ticker.emitTicks(context.Background())
	assert.NoError(t, err)

	// Should not attempt to produce any events
	mockProducer.AssertNotCalled(t, "ProduceEvent")
}

func TestEmitTicks_MultipleWorkspaces(t *testing.T) {
	mockProducer := new(MockEventProducer)
	ticker := &Ticker{
		producer:  mockProducer,
		interval:  time.Minute,
		eventType: WorkspaceTickEventType,
	}

	// Register test workspaces
	workspace.Set("ws-1", workspace.New("ws-1"))
	workspace.Set("ws-2", workspace.New("ws-2"))
	workspace.Set("ws-3", workspace.New("ws-3"))

	// Clean up after test
	defer func() {
		// Note: In a real implementation, we'd have a cleanup method
		// For now, these test workspaces will persist
	}()

	// Expect ticks for each workspace
	mockProducer.On("ProduceEvent", WorkspaceTickEventType, "ws-1", nil).Return(nil)
	mockProducer.On("ProduceEvent", WorkspaceTickEventType, "ws-2", nil).Return(nil)
	mockProducer.On("ProduceEvent", WorkspaceTickEventType, "ws-3", nil).Return(nil)

	err := ticker.emitTicks(context.Background())
	assert.NoError(t, err)

	// Verify all expected events were produced
	mockProducer.AssertExpectations(t)
	mockProducer.AssertNumberOfCalls(t, "ProduceEvent", 3)
}

func TestEmitTickForWorkspace(t *testing.T) {
	mockProducer := new(MockEventProducer)
	ticker := &Ticker{
		producer:  mockProducer,
		interval:  time.Minute,
		eventType: WorkspaceTickEventType,
	}

	workspaceID := "test-workspace"

	mockProducer.On("ProduceEvent", WorkspaceTickEventType, workspaceID, nil).Return(nil)

	err := ticker.emitTickForWorkspace(context.Background(), workspaceID)
	assert.NoError(t, err)

	mockProducer.AssertExpectations(t)
}

func TestGetTickInterval_Default(t *testing.T) {
	// Clear any existing env var
	t.Setenv("WORKSPACE_TICK_INTERVAL_SECONDS", "")

	interval := getTickInterval()
	assert.Equal(t, DefaultTickInterval, interval)
}

func TestGetTickInterval_Custom(t *testing.T) {
	t.Setenv("WORKSPACE_TICK_INTERVAL_SECONDS", "120")

	interval := getTickInterval()
	assert.Equal(t, 120*time.Second, interval)
}

func TestGetTickInterval_Invalid(t *testing.T) {
	t.Setenv("WORKSPACE_TICK_INTERVAL_SECONDS", "invalid")

	interval := getTickInterval()
	assert.Equal(t, DefaultTickInterval, interval, "Should fall back to default on invalid value")
}

func TestGetTickInterval_Negative(t *testing.T) {
	t.Setenv("WORKSPACE_TICK_INTERVAL_SECONDS", "-60")

	interval := getTickInterval()
	assert.Equal(t, DefaultTickInterval, interval, "Should fall back to default on negative value")
}

func TestGetTickInterval_Zero(t *testing.T) {
	t.Setenv("WORKSPACE_TICK_INTERVAL_SECONDS", "0")

	interval := getTickInterval()
	assert.Equal(t, DefaultTickInterval, interval, "Should fall back to default on zero value")
}

func TestTickerRun_Cancellation(t *testing.T) {
	mockProducer := new(MockEventProducer)
	ticker := &Ticker{
		producer:  mockProducer,
		interval:  10 * time.Millisecond, // Short interval for testing
		eventType: WorkspaceTickEventType,
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Allow at least one tick to occur
	mockProducer.On("ProduceEvent", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).
		Maybe()

	// Run ticker in background
	done := make(chan error, 1)
	go func() {
		done <- ticker.Run(ctx)
	}()

	// Let it run for a bit
	time.Sleep(50 * time.Millisecond)

	// Cancel context
	cancel()

	// Wait for ticker to stop
	select {
	case err := <-done:
		assert.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("Ticker did not stop after context cancellation")
	}
}
