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
		Id:        "test-job-123",
		Status:    oapi.JobStatusPending,
		UpdatedAt: time.Now(),
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

	var receivedDuration time.Duration
	timeChannel := make(chan time.Time, 1)
	mockTimeFunc := func(d time.Duration) <-chan time.Time {
		receivedDuration = d
		return timeChannel
	}

	mockProd := &mockProducer{}

	dispatcher := NewTestRunnerDispatcherWithOptions(mockStore, TestRunnerDispatcherOptions{
		TimeFunc:        mockTimeFunc,
		ProducerFactory: newMockProducerFactory(mockProd),
	})

	delaySeconds := 10
	job := &oapi.Job{
		Id:     "test-job-456",
		Status: oapi.JobStatusPending,
		JobAgentConfig: map[string]any{
			"delaySeconds": float64(delaySeconds),
		},
		UpdatedAt: time.Now(),
	}
	mockStore.Jobs.Upsert(context.Background(), job)

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Trigger the time delay
	timeChannel <- time.Now()
	time.Sleep(50 * time.Millisecond)

	// Verify the correct delay was used
	require.Equal(t, time.Duration(delaySeconds)*time.Second, receivedDuration)

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

	failureStatus := "failure"
	job := &oapi.Job{
		Id:     "test-job-789",
		Status: oapi.JobStatusPending,
		JobAgentConfig: map[string]any{
			"status": failureStatus,
		},
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
		JobAgentConfig: map[string]any{
			"message": customMessage,
		},
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
				Id:        "test-job-terminal",
				Status:    terminalStatus,
				UpdatedAt: time.Now(),
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

func TestTestRunnerDispatcher_ParseConfig(t *testing.T) {
	tests := []struct {
		name          string
		jobConfig     map[string]any
		expectError   bool
		errorContains string
		expectedDelay int
		expectedFail  bool
	}{
		{
			name:          "empty config uses defaults",
			jobConfig:     nil,
			expectError:   false,
			expectedDelay: 5, // default
			expectedFail:  false,
		},
		{
			name: "custom delay",
			jobConfig: map[string]any{
				"delaySeconds": float64(30),
			},
			expectError:   false,
			expectedDelay: 30,
			expectedFail:  false,
		},
		{
			name: "failure status",
			jobConfig: map[string]any{
				"status": "failure",
			},
			expectError:   false,
			expectedDelay: 5,
			expectedFail:  true,
		},
		{
			name: "completed status",
			jobConfig: map[string]any{
				"status": "completed",
			},
			expectError:   false,
			expectedDelay: 5,
			expectedFail:  false,
		},
		{
			name: "invalid status",
			jobConfig: map[string]any{
				"status": "invalid",
			},
			expectError:   true,
			errorContains: "invalid status",
		},
		{
			name: "all options",
			jobConfig: map[string]any{
				"delaySeconds": float64(15),
				"status":       "failure",
				"message":      "Test message",
			},
			expectError:   false,
			expectedDelay: 15,
			expectedFail:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dispatcher := &TestRunnerDispatcher{}

			job := &oapi.Job{
				Id:             "test-job",
				JobAgentConfig: tt.jobConfig,
			}

			result, err := dispatcher.parseConfig(job)

			if tt.expectError {
				require.Error(t, err)
				if tt.errorContains != "" {
					require.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)

				expectedDelay := time.Duration(tt.expectedDelay) * time.Second
				actualDelay := dispatcher.getDelay(result)
				require.Equal(t, expectedDelay, actualDelay)

				expectedStatus := oapi.JobStatusSuccessful
				if tt.expectedFail {
					expectedStatus = oapi.JobStatusFailure
				}
				actualStatus := dispatcher.getFinalStatus(result)
				require.Equal(t, expectedStatus, actualStatus)
			}
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
		Id:        "nonexistent-job",
		Status:    oapi.JobStatusPending,
		UpdatedAt: time.Now(),
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
		Id:        "test-job-in-progress",
		Status:    oapi.JobStatusInProgress,
		UpdatedAt: time.Now(),
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

