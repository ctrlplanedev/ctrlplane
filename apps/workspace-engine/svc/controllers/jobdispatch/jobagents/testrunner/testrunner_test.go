package testrunner

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockSetter records calls to UpdateJob so tests can assert on them.
type mockSetter struct {
	mu      sync.Mutex
	calls   []updateJobCall
	err     error
	barrier chan struct{} // if set, blocks until closed
}

type updateJobCall struct {
	JobID   string
	Status  oapi.JobStatus
	Message string
}

func (m *mockSetter) UpdateJob(
	_ context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	if m.barrier != nil {
		<-m.barrier
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, updateJobCall{
		JobID:   jobID,
		Status:  status,
		Message: message,
	})
	return m.err
}

func (m *mockSetter) getCalls() []updateJobCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]updateJobCall, len(m.calls))
	copy(out, m.calls)
	return out
}

// instantTimer returns a timeFunc that resolves immediately.
func instantTimer(d time.Duration) <-chan time.Time {
	ch := make(chan time.Time, 1)
	ch <- time.Now()
	return ch
}

// blockingTimer returns a timeFunc whose channel only fires when the
// returned release function is called.
func blockingTimer() (func(time.Duration) <-chan time.Time, func()) {
	ch := make(chan time.Time, 1)
	return func(d time.Duration) <-chan time.Time { return ch },
		func() { ch <- time.Now() }
}

func newTestJob(id string, config map[string]any) *oapi.Job {
	if config == nil {
		config = map[string]any{}
	}
	return &oapi.Job{
		Id:             id,
		JobAgentConfig: config,
		Status:         oapi.JobStatusPending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       map[string]string{},
	}
}

func ptr[T any](v T) *T { return &v }

// ---------- Type() ----------

func TestType(t *testing.T) {
	tr := New(&mockSetter{})
	assert.Equal(t, "test-runner", tr.Type())
}

// ---------- Dispatch ----------

func TestDispatch_DefaultDelay_SuccessfulStatus(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", nil)
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	require.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, "job-1", call.JobID)
	assert.Equal(t, oapi.JobStatusSuccessful, call.Status)
	assert.Contains(t, call.Message, "Resolved by test-runner after")
}

func TestDispatch_CustomDelay(t *testing.T) {
	setter := &mockSetter{}
	timerFunc, release := blockingTimer()
	tr := &TestRunner{timeFunc: timerFunc, setter: setter}

	job := newTestJob("job-1", map[string]any{"delaySeconds": 30})
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	// Nothing should happen until we release the timer
	time.Sleep(50 * time.Millisecond)
	assert.Empty(t, setter.getCalls())

	release()

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, "job-1", call.JobID)
	assert.Equal(t, oapi.JobStatusSuccessful, call.Status)
}

func TestDispatch_FailureStatus(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", map[string]any{
		"status": "failure",
	})
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, oapi.JobStatusFailure, call.Status)
}

func TestDispatch_CustomMessage(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", map[string]any{
		"message": "custom note",
	})
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Contains(t, call.Message, "custom note")
	assert.Contains(t, call.Message, "Resolved by test-runner after")
}

func TestDispatch_NoMessage(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", nil)
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.NotContains(t, call.Message, "\n")
}

func TestDispatch_InvalidConfig(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", map[string]any{
		"delaySeconds": "not-a-number",
	})
	err := tr.Dispatch(context.Background(), job)
	require.Error(t, err)
	assert.Empty(t, setter.getCalls())
}

func TestDispatch_FailureStatusString(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", map[string]any{
		"status": "successful",
	})
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, oapi.JobStatusSuccessful, call.Status,
		"non-failure status strings should default to successful")
}

func TestDispatch_AllConfigFields(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	job := newTestJob("job-1", map[string]any{
		"delaySeconds": 10,
		"status":       "failure",
		"message":      "all fields set",
	})
	err := tr.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, oapi.JobStatusFailure, call.Status)
	assert.Contains(t, call.Message, "all fields set")
	assert.Contains(t, call.Message, "Resolved by test-runner after 10s")
}

// ---------- Multiple dispatches ----------

func TestDispatch_MultipleJobs(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	for i := 0; i < 5; i++ {
		job := newTestJob(fmt.Sprintf("job-%d", i), nil)
		require.NoError(t, tr.Dispatch(context.Background(), job))
	}

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 5
	}, time.Second, 10*time.Millisecond)

	seen := map[string]bool{}
	for _, c := range setter.getCalls() {
		seen[c.JobID] = true
	}
	for i := 0; i < 5; i++ {
		assert.True(t, seen[fmt.Sprintf("job-%d", i)])
	}
}

// ---------- getDelay ----------

func TestGetDelay_Nil(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{}
	assert.Equal(t, 5*time.Second, tr.getDelay(cfg))
}

func TestGetDelay_Custom(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{DelaySeconds: ptr(30)}
	assert.Equal(t, 30*time.Second, tr.getDelay(cfg))
}

func TestGetDelay_Zero(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{DelaySeconds: ptr(0)}
	assert.Equal(t, time.Duration(0), tr.getDelay(cfg))
}

// ---------- getFinalStatus ----------

func TestGetFinalStatus_Default(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{}
	assert.Equal(t, oapi.JobStatusSuccessful, tr.getFinalStatus(cfg))
}

func TestGetFinalStatus_Failure(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{Status: ptr("failure")}
	assert.Equal(t, oapi.JobStatusFailure, tr.getFinalStatus(cfg))
}

func TestGetFinalStatus_ExplicitSuccessful(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{Status: ptr("successful")}
	assert.Equal(t, oapi.JobStatusSuccessful, tr.getFinalStatus(cfg))
}

func TestGetFinalStatus_UnknownStatus(t *testing.T) {
	tr := New(&mockSetter{})
	cfg := &oapi.TestRunnerJobAgentConfig{Status: ptr("unknown")}
	assert.Equal(t, oapi.JobStatusSuccessful, tr.getFinalStatus(cfg),
		"unrecognized status should default to successful")
}

// ---------- resolveJobAfterDelay ----------

func TestResolveJobAfterDelay_WaitsForTimer(t *testing.T) {
	setter := &mockSetter{}
	timerFunc, release := blockingTimer()
	tr := &TestRunner{timeFunc: timerFunc, setter: setter}

	done := make(chan struct{})
	go func() {
		tr.resolveJobAfterDelay(context.Background(), "job-1", 5*time.Second, oapi.JobStatusSuccessful, "")
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)
	assert.Empty(t, setter.getCalls(), "should not call setter before timer fires")

	release()
	<-done

	calls := setter.getCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "job-1", calls[0].JobID)
}

func TestResolveJobAfterDelay_MessageFormat_WithCustomMessage(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	tr.resolveJobAfterDelay(context.Background(), "job-1", 5*time.Second, oapi.JobStatusSuccessful, "hello")

	calls := setter.getCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "hello\nResolved by test-runner after 5s", calls[0].Message)
}

func TestResolveJobAfterDelay_MessageFormat_NoCustomMessage(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	tr.resolveJobAfterDelay(context.Background(), "job-1", 10*time.Second, oapi.JobStatusFailure, "")

	calls := setter.getCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "Resolved by test-runner after 10s", calls[0].Message)
	assert.Equal(t, oapi.JobStatusFailure, calls[0].Status)
}

// ---------- Concurrency safety ----------

func TestDispatch_ConcurrentDispatches(t *testing.T) {
	setter := &mockSetter{}
	tr := &TestRunner{timeFunc: instantTimer, setter: setter}

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			job := newTestJob(fmt.Sprintf("job-%d", idx), nil)
			_ = tr.Dispatch(context.Background(), job)
		}(i)
	}

	wg.Wait()

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 20
	}, 2*time.Second, 10*time.Millisecond)
}

// ---------- Dispatchable interface ----------

func TestImplementsDispatchable(t *testing.T) {
	var _ interface {
		Type() string
		Dispatch(ctx context.Context, job *oapi.Job) error
	} = &TestRunner{}
}
