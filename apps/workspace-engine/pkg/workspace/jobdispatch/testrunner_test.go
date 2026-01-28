package jobdispatch

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/require"
)

// mockProducer captures published messages for testing
type mockProducer struct {
	mu       sync.Mutex
	messages []mockPublishedMessage
	closed   bool
}

type mockPublishedMessage struct {
	Key   []byte
	Value []byte
}

func (m *mockProducer) Publish(key, value []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, mockPublishedMessage{Key: key, Value: value})
	return nil
}

func (m *mockProducer) PublishToPartition(key, value []byte, partition int32) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, mockPublishedMessage{Key: key, Value: value})
	return nil
}

func (m *mockProducer) Flush(timeoutMs int) int {
	return 0
}

func (m *mockProducer) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	return nil
}

func (m *mockProducer) GetMessages() []mockPublishedMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.messages
}

func newMockProducerFactory(producer *mockProducer) func() (messaging.Producer, error) {
	return func() (messaging.Producer, error) {
		return producer, nil
	}
}

func createJobAgentConfig(_ *testing.T, configPayload map[string]any) oapi.JobAgentConfig {
	if configPayload == nil {
		configPayload = map[string]any{}
	}
	// Always set the type to test-runner for these tests
	configPayload["type"] = "test-runner"
	return configPayload
}

func TestTestRunnerDispatcher_DispatchJob_DefaultConfig(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	// Create a channel that we control for timing
	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		return timeChannel
	}

	// Create mock producer
	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	// Create and store a pending job
	job := &oapi.Job{
		Id:             "test-job-123",
		Status:         oapi.JobStatusPending,
		UpdatedAt:      time.Now(),
		JobAgentConfig: createJobAgentConfig(t, nil),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	// Dispatch the job
	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()

	// Wait a bit for the goroutine to process
	time.Sleep(50 * time.Millisecond)

	// Verify event was published
	messages := mockProd.GetMessages()
	require.Len(t, messages, 1)

	// Parse the published event
	var event map[string]any
	err = json.Unmarshal(messages[0].Value, &event)
	require.NoError(t, err)
	require.Equal(t, "job.updated", event["eventType"])
	require.Equal(t, "test-workspace", event["workspaceId"])

	// Check the job data in the event
	data := event["data"].(map[string]any)
	jobData := data["job"].(map[string]any)
	require.Equal(t, "successful", jobData["status"])
	require.Contains(t, jobData["message"], "Resolved by test-runner dispatcher")
}

func TestTestRunnerDispatcher_DispatchJob_WithDelay(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	// Use a channel to capture the duration safely across goroutines
	durationChan := make(chan time.Duration, 1)
	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		durationChan <- d
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	delaySeconds := 10
	configPayload := map[string]any{
		"delaySeconds": delaySeconds,
	}

	config := createJobAgentConfig(t, configPayload)
	job := &oapi.Job{
		Id:             "test-job-456",
		Status:         oapi.JobStatusPending,
		JobAgentConfig: config,
		UpdatedAt:      time.Now(),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	if err := dispatcher.DispatchJob(context.Background(), job); err != nil {
		t.Fatalf("Failed to dispatch job: %v", err)
	}

	// Wait for the duration to be captured (this happens before timeFunc blocks)
	receivedDuration := <-durationChan

	// Verify the correct delay was used
	require.Equal(t, time.Duration(delaySeconds)*time.Second, receivedDuration)

	// Trigger the time delay to let the goroutine complete
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// Verify event was published
	require.Len(t, mockProd.GetMessages(), 1)
}

func TestTestRunnerDispatcher_DispatchJob_FailureStatus(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	job := &oapi.Job{
		Id:     "test-job-789",
		Status: oapi.JobStatusPending,
		JobAgentConfig: createJobAgentConfig(t, map[string]any{
			"status": "failure",
		}),
		UpdatedAt: time.Now(),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// Verify event was published with failure status
	messages := mockProd.GetMessages()
	require.Len(t, messages, 1)

	var event map[string]any
	err = json.Unmarshal(messages[0].Value, &event)
	require.NoError(t, err)

	data := event["data"].(map[string]any)
	jobData := data["job"].(map[string]any)
	require.Equal(t, "failure", jobData["status"])
}

func TestTestRunnerDispatcher_DispatchJob_WithMessage(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	customMessage := "Custom test message"
	job := &oapi.Job{
		Id:     "test-job-msg",
		Status: oapi.JobStatusPending,
		JobAgentConfig: createJobAgentConfig(t, map[string]any{
			"message": customMessage,
		}),
		UpdatedAt: time.Now(),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// Verify event was published with both messages
	messages := mockProd.GetMessages()
	require.Len(t, messages, 1)

	var event map[string]any
	err = json.Unmarshal(messages[0].Value, &event)
	require.NoError(t, err)

	data := event["data"].(map[string]any)
	jobData := data["job"].(map[string]any)
	message := jobData["message"].(string)
	require.Contains(t, message, customMessage)
	require.Contains(t, message, "Resolved by test-runner dispatcher")
}

func TestTestRunnerDispatcher_SkipsTerminalState(t *testing.T) {
	terminalStates := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
	}

	for _, terminalStatus := range terminalStates {
		t.Run(string(terminalStatus), func(t *testing.T) {
			sc := statechange.NewChangeSet[any]()
			mockStore := store.New("test-workspace", sc)

			timeChannel := make(chan time.Time, 1)
			mockTimeFunc := func(d time.Duration) <-chan time.Time {
				return timeChannel
			}

			mockProd := &mockProducer{}

			dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
				TimeFunc:        mockTimeFunc,
				ProducerFactory: newMockProducerFactory(mockProd),
			})

			job := &oapi.Job{
				Id:             "test-job-terminal",
				Status:         terminalStatus,
				UpdatedAt:      time.Now(),
				JobAgentConfig: createJobAgentConfig(t, nil),
			}
			mockStore.Jobs.Upsert(context.Background(), job)

			err := dispatcher.DispatchJob(context.Background(), job)
			require.NoError(t, err)

			// Trigger the time delay
			timeChannel <- time.Now()
			time.Sleep(50 * time.Millisecond)

			// No event should be published for terminal state jobs
			require.Len(t, mockProd.GetMessages(), 0)
		})
	}
}

func TestTestRunnerDispatcher_JobNotFound(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	// Don't add the job to the store
	job := &oapi.Job{
		Id:             "nonexistent-job",
		Status:         oapi.JobStatusPending,
		UpdatedAt:      time.Now(),
		JobAgentConfig: createJobAgentConfig(t, nil),
	}

	// Dispatch should succeed (goroutine is spawned)
	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// No event should be published for non-existent job
	require.Len(t, mockProd.GetMessages(), 0)
}

func TestTestRunnerDispatcher_InProgressStatus(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	// Job starts as in_progress
	job := &oapi.Job{
		Id:             "test-job-in-progress",
		Status:         oapi.JobStatusInProgress,
		UpdatedAt:      time.Now(),
		JobAgentConfig: createJobAgentConfig(t, nil),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// Event should be published (in_progress is a valid state to resolve)
	messages := mockProd.GetMessages()
	require.Len(t, messages, 1)

	var event map[string]any
	err = json.Unmarshal(messages[0].Value, &event)
	require.NoError(t, err)

	data := event["data"].(map[string]any)
	jobData := data["job"].(map[string]any)
	require.Equal(t, "successful", jobData["status"])
}
