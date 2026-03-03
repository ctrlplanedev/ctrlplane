package github

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

// ----- Mocks -----

type mockWorkflowDispatcher struct {
	mu    sync.Mutex
	calls []dispatchCall
	err   error
}

type dispatchCall struct {
	Cfg    oapi.GithubJobAgentConfig
	Ref    string
	Inputs map[string]any
}

func (m *mockWorkflowDispatcher) DispatchWorkflow(_ context.Context, cfg oapi.GithubJobAgentConfig, ref string, inputs map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, dispatchCall{Cfg: cfg, Ref: ref, Inputs: inputs})
	return m.err
}

func (m *mockWorkflowDispatcher) getCalls() []dispatchCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]dispatchCall, len(m.calls))
	copy(out, m.calls)
	return out
}

type mockSetter struct {
	mu    sync.Mutex
	calls []updateCall
	err   error
}

type updateCall struct {
	JobID   string
	Status  oapi.JobStatus
	Message string
}

func (m *mockSetter) UpdateJob(_ context.Context, jobID string, status oapi.JobStatus, message string, metadata map[string]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, updateCall{JobID: jobID, Status: status, Message: message})
	return m.err
}

func (m *mockSetter) getCalls() []updateCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]updateCall, len(m.calls))
	copy(out, m.calls)
	return out
}

// ----- Helpers -----

func validConfig() oapi.JobAgentConfig {
	return oapi.JobAgentConfig{
		"installationId": float64(12345),
		"owner":          "my-org",
		"repo":           "my-repo",
		"workflowId":     float64(42),
	}
}

func newTestJob(id string, cfg oapi.JobAgentConfig) *oapi.Job {
	return &oapi.Job{
		Id:             id,
		Status:         oapi.JobStatusPending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       map[string]string{},
		JobAgentConfig: cfg,
		DispatchContext: &oapi.DispatchContext{
			JobAgentConfig: cfg,
		},
	}
}

// ----- Type -----

func TestType(t *testing.T) {
	a := New(&mockWorkflowDispatcher{}, &mockSetter{})
	assert.Equal(t, "github-app", a.Type())
}

// ----- Dispatch -----

func TestDispatch_Success_DefaultRef(t *testing.T) {
	wf := &mockWorkflowDispatcher{}
	setter := &mockSetter{}
	a := New(wf, setter)

	job := newTestJob("job-1", validConfig())
	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(wf.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := wf.getCalls()[0]
	assert.Equal(t, "main", call.Ref)
	assert.Equal(t, "my-org", call.Cfg.Owner)
	assert.Equal(t, "my-repo", call.Cfg.Repo)
	assert.Equal(t, int64(42), call.Cfg.WorkflowId)
	assert.Equal(t, 12345, call.Cfg.InstallationId)
	assert.Equal(t, map[string]any{"job_id": "job-1"}, call.Inputs)

	assert.Empty(t, setter.getCalls(), "no setter call on success")
}

func TestDispatch_Success_CustomRef(t *testing.T) {
	wf := &mockWorkflowDispatcher{}
	setter := &mockSetter{}
	a := New(wf, setter)

	cfg := validConfig()
	cfg["ref"] = "release/v2"
	job := newTestJob("job-2", cfg)

	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(wf.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	assert.Equal(t, "release/v2", wf.getCalls()[0].Ref)
}

func TestDispatch_WorkflowFailure_UpdatesJobStatus(t *testing.T) {
	wf := &mockWorkflowDispatcher{err: fmt.Errorf("GitHub API 503")}
	setter := &mockSetter{}
	a := New(wf, setter)

	job := newTestJob("job-3", validConfig())
	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err, "Dispatch itself should not error — failure is async")

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, "job-3", call.JobID)
	assert.Equal(t, oapi.JobStatusInvalidIntegration, call.Status)
	assert.Contains(t, call.Message, "GitHub API 503")
}

func TestDispatch_WorkflowSuccess_NoSetterCall(t *testing.T) {
	wf := &mockWorkflowDispatcher{}
	setter := &mockSetter{}
	a := New(wf, setter)

	job := newTestJob("job-4", validConfig())
	_ = a.Dispatch(context.Background(), job)

	assert.Eventually(t, func() bool {
		return len(wf.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	time.Sleep(50 * time.Millisecond)
	assert.Empty(t, setter.getCalls())
}

func TestDispatch_InvalidConfig_ReturnsError(t *testing.T) {
	wf := &mockWorkflowDispatcher{}
	setter := &mockSetter{}
	a := New(wf, setter)

	job := newTestJob("job-5", oapi.JobAgentConfig{})
	err := a.Dispatch(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse job agent config")
	assert.Empty(t, wf.getCalls(), "should not dispatch on invalid config")
}

// ----- ParseJobAgentConfig -----

func TestParseJobAgentConfig_Valid(t *testing.T) {
	cfg, err := ParseJobAgentConfig(validConfig())
	require.NoError(t, err)
	assert.Equal(t, 12345, cfg.InstallationId)
	assert.Equal(t, "my-org", cfg.Owner)
	assert.Equal(t, "my-repo", cfg.Repo)
	assert.Equal(t, int64(42), cfg.WorkflowId)
	assert.Nil(t, cfg.Ref)
}

func TestParseJobAgentConfig_WithRef(t *testing.T) {
	raw := validConfig()
	raw["ref"] = "develop"
	cfg, err := ParseJobAgentConfig(raw)
	require.NoError(t, err)
	require.NotNil(t, cfg.Ref)
	assert.Equal(t, "develop", *cfg.Ref)
}

func TestParseJobAgentConfig_MissingInstallationId(t *testing.T) {
	raw := validConfig()
	delete(raw, "installationId")
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "installationId")
}

func TestParseJobAgentConfig_MissingOwner(t *testing.T) {
	raw := validConfig()
	delete(raw, "owner")
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "owner")
}

func TestParseJobAgentConfig_MissingRepo(t *testing.T) {
	raw := validConfig()
	delete(raw, "repo")
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "repo")
}

func TestParseJobAgentConfig_MissingWorkflowId(t *testing.T) {
	raw := validConfig()
	delete(raw, "workflowId")
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "workflowId")
}

func TestParseJobAgentConfig_EmptyOwner(t *testing.T) {
	raw := validConfig()
	raw["owner"] = ""
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "owner")
}

func TestParseJobAgentConfig_EmptyRepo(t *testing.T) {
	raw := validConfig()
	raw["repo"] = ""
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "repo")
}

func TestParseJobAgentConfig_EmptyRefIgnored(t *testing.T) {
	raw := validConfig()
	raw["ref"] = ""
	cfg, err := ParseJobAgentConfig(raw)
	require.NoError(t, err)
	assert.Nil(t, cfg.Ref)
}

func TestParseJobAgentConfig_ZeroInstallationId(t *testing.T) {
	raw := validConfig()
	raw["installationId"] = float64(0)
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "installationId")
}

func TestParseJobAgentConfig_ZeroWorkflowId(t *testing.T) {
	raw := validConfig()
	raw["workflowId"] = float64(0)
	_, err := ParseJobAgentConfig(raw)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "workflowId")
}

// ----- toInt / toInt64 -----

func TestToInt(t *testing.T) {
	tests := []struct {
		name   string
		input  any
		expect int
	}{
		{"int", 42, 42},
		{"float64", float64(42), 42},
		{"string", "42", 0},
		{"nil", nil, 0},
		{"bool", true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, toInt(tt.input))
		})
	}
}

func TestToInt64(t *testing.T) {
	tests := []struct {
		name   string
		input  any
		expect int64
	}{
		{"int64", int64(42), 42},
		{"int", 42, 42},
		{"float64", float64(42), 42},
		{"string", "42", 0},
		{"nil", nil, 0},
		{"bool", true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, toInt64(tt.input))
		})
	}
}

// ----- Concurrent dispatches -----

func TestDispatch_ConcurrentDispatches(t *testing.T) {
	wf := &mockWorkflowDispatcher{}
	setter := &mockSetter{}
	a := New(wf, setter)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			job := newTestJob(fmt.Sprintf("job-%d", idx), validConfig())
			_ = a.Dispatch(context.Background(), job)
		}(i)
	}
	wg.Wait()

	assert.Eventually(t, func() bool {
		return len(wf.getCalls()) == 10
	}, 2*time.Second, 10*time.Millisecond)
}
