package argo

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockSetter struct {
	mu    sync.Mutex
	calls []setterCall
	err   error
}

type setterCall struct {
	JobId    string
	Status   oapi.JobStatus
	Message  string
	Metadata map[string]string
}

func (m *mockSetter) UpdateJob(
	_ context.Context,
	jobId string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, setterCall{JobId: jobId, Status: status, Message: message, Metadata: metadata})
	return m.err
}

func (m *mockSetter) getCalls() []setterCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]setterCall, len(m.calls))
	copy(out, m.calls)
	return out
}

type mockUpserter struct {
	err error
}

func (m *mockUpserter) UpsertApplication(_ context.Context, _, _ string, _ *v1alpha1.Application) error {
	return m.err
}

// --- helpers ---

func testJob() *oapi.Job {
	return &oapi.Job{
		Id:     "job-1",
		Status: oapi.JobStatusPending,
		DispatchContext: &oapi.DispatchContext{
			JobAgent: oapi.JobAgent{
				WorkspaceId: "ws-1",
			},
			JobAgentConfig: oapi.JobAgentConfig{
				"serverUrl": "argocd.example.com",
				"apiKey":    "test-token",
				"template":  "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: test-app\n  namespace: argocd\nspec:\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: default\n  source:\n    repoURL: https://github.com/example/repo\n    path: manifests\n  project: default",
			},
		},
		Metadata: map[string]string{},
	}
}

// --- tests ---

func TestType(t *testing.T) {
	a := New(&mockUpserter{}, &mockSetter{})
	assert.Equal(t, "argo-cd", a.Type())
}

func TestDispatch_Success(t *testing.T) {
	setter := &mockSetter{}
	upserter := &mockUpserter{}
	a := New(upserter, setter)

	err := a.Dispatch(context.Background(), testJob())
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, 5*time.Second, 50*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, oapi.JobStatusSuccessful, call.Status)
	assert.Empty(t, call.Message)
	assert.Contains(t, call.Metadata["ctrlplane/links"], "ArgoCD Application")
}

func TestDispatch_UpsertFailure(t *testing.T) {
	setter := &mockSetter{}
	upserter := &mockUpserter{err: fmt.Errorf("connection refused")}
	a := New(upserter, setter)

	err := a.Dispatch(context.Background(), testJob())
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, 5*time.Second, 50*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, oapi.JobStatusFailure, call.Status)
	assert.Contains(t, call.Message, "failed to upsert application")
}

func TestDispatch_BadConfig(t *testing.T) {
	a := New(&mockUpserter{}, &mockSetter{})
	job := testJob()
	job.DispatchContext.JobAgentConfig = oapi.JobAgentConfig{}

	err := a.Dispatch(context.Background(), job)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse job agent config")
}

func TestParseJobAgentConfig(t *testing.T) {
	tests := []struct {
		name     string
		config   oapi.JobAgentConfig
		wantErr  bool
		wantAddr string
		wantKey  string
		wantTmpl string
	}{
		{
			name: "valid config",
			config: oapi.JobAgentConfig{
				"serverUrl": "argocd.example.com",
				"apiKey":    "token",
				"template":  "yaml",
			},
			wantAddr: "argocd.example.com",
			wantKey:  "token",
			wantTmpl: "yaml",
		},
		{
			name:    "missing serverUrl",
			config:  oapi.JobAgentConfig{"apiKey": "token", "template": "yaml"},
			wantErr: true,
		},
		{
			name:    "missing apiKey",
			config:  oapi.JobAgentConfig{"serverUrl": "addr", "template": "yaml"},
			wantErr: true,
		},
		{
			name:    "missing template",
			config:  oapi.JobAgentConfig{"serverUrl": "addr", "apiKey": "token"},
			wantErr: true,
		},
		{
			name:    "empty values",
			config:  oapi.JobAgentConfig{"serverUrl": "", "apiKey": "", "template": ""},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			addr, key, tmpl, err := ParseJobAgentConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantAddr, addr)
			assert.Equal(t, tt.wantKey, key)
			assert.Equal(t, tt.wantTmpl, tmpl)
		})
	}
}

func TestMakeApplicationK8sCompatible(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase", "My-App", "my-app"},
		{"special chars", "my_app.v1", "my-app-v1"},
		{"too long", string(make([]byte, 100)), "default"},
		{"empty after clean", "___", "default"},
		{"trim dashes", "-my-app-", "my-app"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &v1alpha1.Application{}
			app.Name = tt.input
			MakeApplicationK8sCompatible(app)
			assert.Equal(t, tt.expected, app.Name)
		})
	}
}

func TestBuildArgoLinks(t *testing.T) {
	app := &v1alpha1.Application{}
	app.Name = "my-app"
	app.Namespace = "argocd"

	links := BuildArgoLinks("argocd.example.com", app)
	assert.Contains(t, links["ctrlplane/links"], "https://argocd.example.com/applications/argocd/my-app")

	linksHTTPS := BuildArgoLinks("https://argocd.example.com", app)
	assert.Contains(t, linksHTTPS["ctrlplane/links"], "https://argocd.example.com/applications/argocd/my-app")
}

func TestVerifications_ValidConfig(t *testing.T) {
	a := New(&mockUpserter{}, &mockSetter{})
	config := oapi.JobAgentConfig{
		"serverUrl": "argocd.example.com",
		"apiKey":    "test-token",
	}

	specs, err := a.Verifications(config)
	require.NoError(t, err)
	require.Len(t, specs, 1)
	assert.Equal(t, "argocd-application-health", specs[0].Name)
	assert.Equal(t, int32(60), specs[0].IntervalSeconds)
	assert.Equal(t, 10, specs[0].Count)
}

func TestVerifications_MissingServerUrl(t *testing.T) {
	a := New(&mockUpserter{}, &mockSetter{})
	specs, err := a.Verifications(oapi.JobAgentConfig{"apiKey": "token"})
	require.NoError(t, err)
	assert.Nil(t, specs)
}

func TestVerifications_MissingApiKey(t *testing.T) {
	a := New(&mockUpserter{}, &mockSetter{})
	specs, err := a.Verifications(oapi.JobAgentConfig{"serverUrl": "addr"})
	require.NoError(t, err)
	assert.Nil(t, specs)
}
