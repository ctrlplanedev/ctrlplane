package argo

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
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
	m.calls = append(
		m.calls,
		setterCall{JobId: jobId, Status: status, Message: message, Metadata: metadata},
	)
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

func (m *mockUpserter) UpsertApplication(
	_ context.Context,
	_, _ string,
	_ *v1alpha1.Application,
) error {
	return m.err
}

type mockDeleter struct {
	mu    sync.Mutex
	calls []string
	err   error
}

func (m *mockDeleter) DeleteApplication(
	_ context.Context,
	_, _, name string,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, name)
	return m.err
}

func (m *mockDeleter) getCalls() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]string, len(m.calls))
	copy(out, m.calls)
	return out
}

type mockManifestGetter struct {
	fn func(ctx context.Context, serverAddr, apiKey, appName string) ([]string, error)
}

func (m *mockManifestGetter) GetManifests(
	ctx context.Context,
	serverAddr, apiKey, appName string,
) ([]string, error) {
	if m.fn != nil {
		return m.fn(ctx, serverAddr, apiKey, appName)
	}
	return nil, nil
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
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	assert.Equal(t, "argo-cd", a.Type())
}

func TestDispatch_Success(t *testing.T) {
	setter := &mockSetter{}
	upserter := &mockUpserter{}
	a := New(upserter, &mockDeleter{}, setter, &mockManifestGetter{})

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
	a := New(upserter, &mockDeleter{}, setter, &mockManifestGetter{})

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
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	job := testJob()
	job.DispatchContext.JobAgentConfig = oapi.JobAgentConfig{}

	err := a.Dispatch(context.Background(), job)
	require.Error(t, err)
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
				require.Error(t, err)
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
	assert.Contains(
		t,
		links["ctrlplane/links"],
		"https://argocd.example.com/applications/argocd/my-app",
	)

	linksHTTPS := BuildArgoLinks("https://argocd.example.com", app)
	assert.Contains(
		t,
		linksHTTPS["ctrlplane/links"],
		"https://argocd.example.com/applications/argocd/my-app",
	)
}

func TestVerifications_ValidConfig(t *testing.T) {
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
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
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	specs, err := a.Verifications(oapi.JobAgentConfig{"apiKey": "token"})
	require.NoError(t, err)
	assert.Nil(t, specs)
}

func TestVerifications_MissingApiKey(t *testing.T) {
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	specs, err := a.Verifications(oapi.JobAgentConfig{"serverUrl": "addr"})
	require.NoError(t, err)
	assert.Nil(t, specs)
}

// --- plan / diff tests ---

func testDispatchCtx() *oapi.DispatchContext {
	return testJob().DispatchContext
}

func planManifestGetter(current, proposed []string) *mockManifestGetter {
	return &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return proposed, nil
			}
			return current, nil
		},
	}
}

func TestPlan_HasChanges(t *testing.T) {
	current := []string{`{"kind":"Deployment","metadata":{"name":"app"},"spec":{"replicas":1}}`}
	proposed := []string{`{"kind":"Deployment","metadata":{"name":"app"},"spec":{"replicas":3}}`}

	a := New(
		&mockUpserter{},
		&mockDeleter{},
		&mockSetter{},
		planManifestGetter(current, proposed),
	)

	result, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)
	assert.True(t, result.HasChanges)
	assert.NotEmpty(t, result.ContentHash)
	assert.Equal(t, current[0], result.Current)
	assert.Equal(t, proposed[0], result.Proposed)
}

func TestPlan_NoChanges(t *testing.T) {
	manifests := []string{`{"kind":"Deployment","metadata":{"name":"app"},"spec":{"replicas":1}}`}

	a := New(
		&mockUpserter{},
		&mockDeleter{},
		&mockSetter{},
		planManifestGetter(manifests, manifests),
	)

	result, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)
	assert.False(t, result.HasChanges)
	assert.NotEmpty(t, result.ContentHash)
	assert.Equal(t, result.Current, result.Proposed)
}

func TestPlan_MultipleManifests(t *testing.T) {
	current := []string{
		`{"kind":"Deployment","metadata":{"name":"web"}}`,
		`{"kind":"Service","metadata":{"name":"web"}}`,
	}
	proposed := []string{
		`{"kind":"Deployment","metadata":{"name":"web"},"spec":{"replicas":2}}`,
		`{"kind":"Service","metadata":{"name":"web"}}`,
	}

	a := New(
		&mockUpserter{},
		&mockDeleter{},
		&mockSetter{},
		planManifestGetter(current, proposed),
	)

	result, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)
	assert.True(t, result.HasChanges)
	assert.Contains(t, result.Current, "---\n")
	assert.Contains(t, result.Proposed, "---\n")
}

func TestPlan_ContentHashDeterministic(t *testing.T) {
	current := []string{`{"kind":"ConfigMap","metadata":{"name":"cfg"}}`}
	proposed := []string{`{"kind":"ConfigMap","metadata":{"name":"cfg"},"data":{"k":"v"}}`}

	a := New(
		&mockUpserter{},
		&mockDeleter{},
		&mockSetter{},
		planManifestGetter(current, proposed),
	)

	r1, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)

	r2, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)

	assert.Equal(t, r1.ContentHash, r2.ContentHash)
}

func TestPlan_BadConfig(t *testing.T) {
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	dctx := testDispatchCtx()
	dctx.JobAgentConfig = oapi.JobAgentConfig{}

	_, err := a.Plan(context.Background(), dctx)
	require.Error(t, err)
}

func TestPlan_UpsertFailure(t *testing.T) {
	a := New(
		&mockUpserter{err: fmt.Errorf("conflict")},
		&mockDeleter{},
		&mockSetter{},
		&mockManifestGetter{},
	)

	_, err := a.Plan(context.Background(), testDispatchCtx())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "create temporary plan application")
}

func TestPlan_GetProposedManifestsFailure(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return nil, fmt.Errorf("not found")
			}
			return []string{"manifest"}, nil
		},
	}
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, getter)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := a.Plan(ctx, testDispatchCtx())
	require.Error(t, err)
}

func TestPlan_GetCurrentManifestsFailure(t *testing.T) {
	calls := 0
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				calls++
				return []string{"proposed"}, nil
			}
			return nil, fmt.Errorf("current app not found")
		},
	}
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, getter)

	_, err := a.Plan(context.Background(), testDispatchCtx())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get current manifests")
}

func TestPlan_WaitForManifestsTimeout(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, _ string) ([]string, error) {
			return nil, nil
		},
	}
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, getter)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := a.Plan(ctx, testDispatchCtx())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "wait for temporary app manifests")
}

func TestPlan_DeletesTemporaryAppOnSuccess(t *testing.T) {
	current := []string{`{"kind":"Deployment"}`}
	proposed := []string{`{"kind":"Deployment","spec":{"replicas":2}}`}
	deleter := &mockDeleter{}

	a := New(
		&mockUpserter{},
		deleter,
		&mockSetter{},
		planManifestGetter(current, proposed),
	)

	_, err := a.Plan(context.Background(), testDispatchCtx())
	require.NoError(t, err)

	calls := deleter.getCalls()
	require.Len(t, calls, 1)
	assert.Contains(t, calls[0], "-plan-")
}

func TestPlan_DeletesTemporaryAppOnManifestError(t *testing.T) {
	deleter := &mockDeleter{}
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return []string{"proposed"}, nil
			}
			return nil, fmt.Errorf("current app not found")
		},
	}

	a := New(&mockUpserter{}, deleter, &mockSetter{}, getter)

	_, err := a.Plan(context.Background(), testDispatchCtx())
	require.Error(t, err)

	calls := deleter.getCalls()
	require.Len(t, calls, 1)
	assert.Contains(t, calls[0], "-plan-")
}

func TestPlan_DeleteNotCalledOnUpsertFailure(t *testing.T) {
	deleter := &mockDeleter{}
	a := New(
		&mockUpserter{err: fmt.Errorf("conflict")},
		deleter,
		&mockSetter{},
		&mockManifestGetter{},
	)

	_, err := a.Plan(context.Background(), testDispatchCtx())
	require.Error(t, err)
	assert.Empty(t, deleter.getCalls())
}

func TestIsRetryableError(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		retryable bool
	}{
		{"nil error", nil, false},
		{"502", fmt.Errorf("server returned 502"), true},
		{"503", fmt.Errorf("503 Service Unavailable"), true},
		{"504", fmt.Errorf("504 Gateway Timeout"), true},
		{"connection refused", fmt.Errorf("connection refused"), true},
		{"connection reset", fmt.Errorf("connection reset by peer"), true},
		{"timeout", fmt.Errorf("request timeout"), true},
		{"temporarily unavailable", fmt.Errorf("service temporarily unavailable"), true},
		{"EOF", fmt.Errorf("unexpected EOF"), true},
		{"Unavailable", fmt.Errorf("Unavailable"), true},
		{"not found", fmt.Errorf("application not found"), false},
		{"permission denied", fmt.Errorf("permission denied"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.retryable, isRetryableError(tt.err))
		})
	}
}
