package argo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
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
	job := testJob()
	config := job.DispatchContext.JobAgentConfig

	specs, err := a.Verifications(config, job.DispatchContext)
	require.NoError(t, err)
	require.Len(t, specs, 1)
	assert.Equal(t, "argocd-application-health", specs[0].Name)
	assert.Equal(t, int32(60), specs[0].IntervalSeconds)
	assert.Equal(t, 10, specs[0].Count)
}

func TestVerifications_MissingServerUrl(t *testing.T) {
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	specs, err := a.Verifications(
		oapi.JobAgentConfig{"apiKey": "token", "template": "yaml"},
		testJob().DispatchContext,
	)
	require.NoError(t, err)
	assert.Nil(t, specs)
}

func TestVerifications_MissingApiKey(t *testing.T) {
	a := New(&mockUpserter{}, &mockDeleter{}, &mockSetter{}, &mockManifestGetter{})
	specs, err := a.Verifications(
		oapi.JobAgentConfig{"serverUrl": "addr", "template": "yaml"},
		testJob().DispatchContext,
	)
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

	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, planManifestGetter(current, proposed))

	result, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)
	assert.True(t, result.HasChanges)
	assert.NotEmpty(t, result.ContentHash)
	assert.Contains(t, result.Current, "replicas: 1")
	assert.Contains(t, result.Proposed, "replicas: 3")
}

func TestPlan_NoChanges(t *testing.T) {
	manifests := []string{`{"kind":"Deployment","metadata":{"name":"app"},"spec":{"replicas":1}}`}

	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, planManifestGetter(manifests, manifests))

	result, err := p.Plan(context.Background(), testDispatchCtx(), nil)
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

	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, planManifestGetter(current, proposed))

	result, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)
	assert.True(t, result.HasChanges)
	assert.Contains(t, result.Current, "---\n")
	assert.Contains(t, result.Proposed, "---\n")
}

func TestPlan_ContentHashDeterministic(t *testing.T) {
	current := []string{`{"kind":"ConfigMap","metadata":{"name":"cfg"}}`}
	proposed := []string{`{"kind":"ConfigMap","metadata":{"name":"cfg"},"data":{"k":"v"}}`}

	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, planManifestGetter(current, proposed))

	r1, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)

	r2, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)

	assert.Equal(t, r1.ContentHash, r2.ContentHash)
}

func TestPlan_BadConfig(t *testing.T) {
	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, &mockManifestGetter{})
	dctx := testDispatchCtx()
	dctx.JobAgentConfig = oapi.JobAgentConfig{}

	_, err := p.Plan(context.Background(), dctx, nil)
	require.Error(t, err)
}

func TestPlan_UpsertFailure(t *testing.T) {
	p := NewArgoCDPlanner(
		&mockUpserter{err: fmt.Errorf("conflict")},
		&mockDeleter{},
		&mockManifestGetter{},
	)

	_, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "upsert temporary plan application")
}

func TestPlan_GetProposedManifestsFailure_ReturnsIncomplete(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return nil, fmt.Errorf("not found")
			}
			return []string{"manifest"}, nil
		},
	}
	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, getter)

	result, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)
	assert.Nil(t, result.CompletedAt)
	assert.NotEmpty(t, result.State)
	assert.Contains(t, result.Message, "Retrying manifest fetch")

	var s argoPlanState
	require.NoError(t, json.Unmarshal(result.State, &s))
	assert.Equal(t, 1, s.ManifestChecks)
	assert.NotNil(t, s.FirstCheckedAt)
	assert.NotNil(t, s.LastCheckedAt)
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
	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, getter)

	_, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get current manifests")
}

func TestPlan_EmptyManifests_ReturnsIncomplete(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, _ string) ([]string, error) {
			return nil, nil
		},
	}
	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, getter)

	result, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)
	assert.Nil(t, result.CompletedAt)
	assert.NotEmpty(t, result.State)
	assert.Contains(t, result.Message, "Waiting for manifests to render")

	var s argoPlanState
	require.NoError(t, json.Unmarshal(result.State, &s))
	assert.Equal(t, 1, s.ManifestChecks)
	assert.NotNil(t, s.FirstCheckedAt)
	assert.NotNil(t, s.LastCheckedAt)
}

func TestPlan_ManifestTimeout_Exhausted_WithError(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return nil, fmt.Errorf("not found")
			}
			return []string{"manifest"}, nil
		},
	}
	deleter := &mockDeleter{}
	p := NewArgoCDPlanner(&mockUpserter{}, deleter, getter)

	expired := time.Now().Add(-manifestTimeout - time.Second)
	state, _ := json.Marshal(argoPlanState{
		TmpAppName:     "test-app-plan-abc",
		ManifestChecks: 5,
		FirstCheckedAt: &expired,
	})

	_, err := p.Plan(context.Background(), testDispatchCtx(), state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
	assert.Contains(t, err.Error(), "6 checks")
	require.Len(t, deleter.getCalls(), 1, "should delete tmp app on timeout")
}

func TestPlan_ManifestTimeout_Exhausted_EmptyManifests(t *testing.T) {
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, _ string) ([]string, error) {
			return nil, nil
		},
	}
	deleter := &mockDeleter{}
	p := NewArgoCDPlanner(&mockUpserter{}, deleter, getter)

	expired := time.Now().Add(-manifestTimeout - time.Second)
	state, _ := json.Marshal(argoPlanState{
		TmpAppName:     "test-app-plan-abc",
		ManifestChecks: 5,
		FirstCheckedAt: &expired,
	})

	_, err := p.Plan(context.Background(), testDispatchCtx(), state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no manifests found after")
	assert.Contains(t, err.Error(), "6 checks")
	require.Len(t, deleter.getCalls(), 1, "should delete tmp app on timeout")
}

func TestPlan_ManifestTimeout_SucceedsBeforeExpiry(t *testing.T) {
	current := []string{`{"kind":"Deployment"}`}
	proposed := []string{`{"kind":"Deployment","spec":{"replicas":2}}`}
	p := NewArgoCDPlanner(&mockUpserter{}, &mockDeleter{}, planManifestGetter(current, proposed))

	recent := time.Now().Add(-30 * time.Second)
	state, _ := json.Marshal(argoPlanState{
		TmpAppName:     "test-app-plan-abc",
		ManifestChecks: 3,
		FirstCheckedAt: &recent,
	})

	result, err := p.Plan(context.Background(), testDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt, "should complete when manifests are found")
	assert.True(t, result.HasChanges)
}

func TestPlan_DeletesTemporaryAppOnSuccess(t *testing.T) {
	current := []string{`{"kind":"Deployment"}`}
	proposed := []string{`{"kind":"Deployment","spec":{"replicas":2}}`}
	deleter := &mockDeleter{}

	p := NewArgoCDPlanner(&mockUpserter{}, deleter, planManifestGetter(current, proposed))

	_, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.NoError(t, err)

	calls := deleter.getCalls()
	require.Len(t, calls, 1)
	assert.Contains(t, calls[0], "-plan-")
}

func TestPlan_CurrentManifestError_DeletesTmpApp(t *testing.T) {
	deleter := &mockDeleter{}
	getter := &mockManifestGetter{
		fn: func(_ context.Context, _, _, appName string) ([]string, error) {
			if strings.Contains(appName, "-plan-") {
				return []string{"proposed"}, nil
			}
			return nil, fmt.Errorf("current app not found")
		},
	}

	p := NewArgoCDPlanner(&mockUpserter{}, deleter, getter)

	_, err := p.Plan(context.Background(), testDispatchCtx(), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get current manifests")

	calls := deleter.getCalls()
	require.Len(t, calls, 1)
	assert.Contains(t, calls[0], "-plan-")
}

func TestPlan_DeleteNotCalledOnUpsertFailure(t *testing.T) {
	deleter := &mockDeleter{}
	p := NewArgoCDPlanner(
		&mockUpserter{err: fmt.Errorf("conflict")},
		deleter,
		&mockManifestGetter{},
	)

	_, err := p.Plan(context.Background(), testDispatchCtx(), nil)
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
