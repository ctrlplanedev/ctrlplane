package argo_workflows

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ----- Mocks -----

type mockSubmitter struct {
	mu     sync.Mutex
	calls  []submitCall
	err    error
	result *wfv1.Workflow
}

type submitCall struct {
	ServerAddr string
	APIKey     string
	Workflow   *wfv1.Workflow
}

func (m *mockSubmitter) SubmitWorkflow(
	_ context.Context,
	serverAddr, apiKey string,
	wf *wfv1.Workflow,
) (*wfv1.Workflow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, submitCall{ServerAddr: serverAddr, APIKey: apiKey, Workflow: wf})
	if m.result != nil {
		return m.result, m.err
	}
	// Echo back the submitted workflow by default.
	return wf, m.err
}

func (m *mockSubmitter) getCalls() []submitCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]submitCall, len(m.calls))
	copy(out, m.calls)
	return out
}

type mockSetter struct {
	mu    sync.Mutex
	calls []updateCall
	err   error
}

type updateCall struct {
	JobID    string
	Status   oapi.JobStatus
	Message  string
	Metadata map[string]string
}

func (m *mockSetter) UpdateJob(
	_ context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, updateCall{JobID: jobID, Status: status, Message: message, Metadata: metadata})
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

const minimalWorkflowTemplate = `
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: my-workflow-
  namespace: argo
spec:
  entrypoint: whalesay
  templates:
  - name: whalesay
    container:
      image: docker/whalesay
      command: [cowsay]
      args: ["hello world"]
`

const nonInlineWorkflowTemplate = `
{{- $resourceName := .resource.name }}
{{- $resourceIdentifier := .resource.identifier }}
{{- $environmentName := .environment.name }}
{{- $repo := .release.version.tag }}
{
  "repo": "{{$repo}}",
  "resource": "{{$resourceName}}",
  "environment": "{{$environmentName}}"
}
`

func validConfig() oapi.JobAgentConfig {
	return oapi.JobAgentConfig{
		"serverUrl": "https://argo.example.com",
		"apiKey":    "secret-token",
		"template":  minimalWorkflowTemplate,
		"inline":    true,
		"name":      "job-1",
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

// ----- TemplateApplication (non-inline) -----

func TestTemplateApplication_NonInline_RendersParamsAndCreatesTemplateRef(t *testing.T) {
	tag := "v1.2.3"
	ctx := &oapi.DispatchContext{
		Resource: &oapi.Resource{
			Name:       "my-resource",
			Identifier: "res-id-123",
		},
		Environment: &oapi.Environment{
			Name: "production",
		},
		Release: &oapi.Release{
			Version: oapi.DeploymentVersion{
				Tag: tag,
			},
		},
		JobAgent:       oapi.JobAgent{},
		JobAgentConfig: oapi.JobAgentConfig{},
	}

	wf, err := TemplateApplication(ctx, nonInlineWorkflowTemplate, false, "my-workflow", "default")
	require.NoError(t, err)
	assert.Equal(t, "my-workflow-", wf.GenerateName)
	require.NotNil(t, wf.Spec.WorkflowTemplateRef)
	assert.Equal(t, "my-workflow", wf.Spec.WorkflowTemplateRef.Name)

	params := make(map[string]string)
	for _, p := range wf.Spec.Arguments.Parameters {
		params[p.Name] = p.Value.String()
	}
	assert.Equal(t, tag, params["repo"])
	assert.Equal(t, "my-resource", params["resource"])
	assert.Equal(t, "production", params["environment"])
}

// ----- Type -----

func TestType(t *testing.T) {
	a := New(&mockSubmitter{}, &mockSetter{})
	assert.Equal(t, "argo-workflow", a.Type())
}

// ----- Dispatch -----

func TestDispatch_Success_SubmitsWorkflow(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-1", validConfig())
	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(sub.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := sub.getCalls()[0]
	assert.Equal(t, "https://argo.example.com", call.ServerAddr)
	assert.Equal(t, "secret-token", call.APIKey)
	assert.NotNil(t, call.Workflow)
}

func TestDispatch_Success_SetsJobInProgress(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-2", validConfig())
	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, "job-2", call.JobID)
	assert.Equal(t, oapi.JobStatusInProgress, call.Status)
}

func TestDispatch_Success_MetadataContainsArgoLink(t *testing.T) {
	created := &wfv1.Workflow{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-workflow-abc",
			Namespace: "argo",
		},
	}
	sub := &mockSubmitter{result: created}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-3", validConfig())
	_ = a.Dispatch(context.Background(), job)

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	meta := setter.getCalls()[0].Metadata
	require.Contains(t, meta, "ctrlplane/links")
	assert.Contains(t, meta["ctrlplane/links"], "my-workflow-abc")
}

func TestDispatch_SubmitFailure_SetsJobFailure(t *testing.T) {
	sub := &mockSubmitter{err: fmt.Errorf("argo server unavailable")}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-4", validConfig())
	err := a.Dispatch(context.Background(), job)
	require.NoError(t, err, "Dispatch itself should not error — failure is async")

	assert.Eventually(t, func() bool {
		return len(setter.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	call := setter.getCalls()[0]
	assert.Equal(t, "job-4", call.JobID)
	assert.Equal(t, oapi.JobStatusFailure, call.Status)
	assert.Contains(t, call.Message, "argo server unavailable")
}

func TestDispatch_NilDispatchContext_ReturnsError(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := &oapi.Job{Id: "job-5", DispatchContext: nil}
	err := a.Dispatch(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "no dispatch context")
}

func TestDispatch_InvalidConfig_ReturnsError(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-6", oapi.JobAgentConfig{})
	err := a.Dispatch(context.Background(), job)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse job agent config")
	assert.Empty(t, sub.getCalls())
}

func TestDispatch_SetsJobIDLabel(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	job := newTestJob("job-7", validConfig())
	_ = a.Dispatch(context.Background(), job)

	assert.Eventually(t, func() bool {
		return len(sub.getCalls()) == 1
	}, time.Second, 10*time.Millisecond)

	wf := sub.getCalls()[0].Workflow
	assert.Equal(t, "job-7", wf.Labels["job-id"])
}

func TestDispatch_ConcurrentDispatches(t *testing.T) {
	sub := &mockSubmitter{}
	setter := &mockSetter{}
	a := New(sub, setter)

	var wg sync.WaitGroup
	for i := range 10 {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			job := newTestJob(fmt.Sprintf("job-%d", idx), validConfig())
			_ = a.Dispatch(context.Background(), job)
		}(i)
	}
	wg.Wait()

	assert.Eventually(t, func() bool {
		return len(sub.getCalls()) == 10
	}, 2*time.Second, 10*time.Millisecond)
}

// ----- ParseJobAgentConfig -----

func TestParseJobAgentConfig_Valid(t *testing.T) {
	c, err := ParseJobAgentConfig(validConfig())
	require.NoError(t, err)
	assert.Equal(t, "https://argo.example.com", c.serverAddr)
	assert.Equal(t, "secret-token", c.apiKey)
	assert.Equal(t, minimalWorkflowTemplate, c.template)
}

func TestParseJobAgentConfig_MissingServerUrl(t *testing.T) {
	cfg := validConfig()
	delete(cfg, "serverUrl")
	_, err := ParseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "serverUrl")
}

func TestParseJobAgentConfig_MissingApiKey(t *testing.T) {
	cfg := validConfig()
	delete(cfg, "apiKey")
	_, err := ParseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "apiKey")
}

func TestParseJobAgentConfig_MissingTemplate(t *testing.T) {
	cfg := validConfig()
	delete(cfg, "template")
	_, err := ParseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "template")
}

func TestParseJobAgentConfig_EmptyServerUrl(t *testing.T) {
	cfg := validConfig()
	cfg["serverUrl"] = ""
	_, err := ParseJobAgentConfig(cfg)
	require.Error(t, err)
}

func TestParseJobAgentConfig_EmptyTemplate(t *testing.T) {
	cfg := validConfig()
	cfg["template"] = ""
	_, err := ParseJobAgentConfig(cfg)
	require.Error(t, err)
}

// ----- MakeApplicationK8sCompatible -----

func TestMakeApplicationK8sCompatible_SanitisesName(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: "My_Workflow 1!"}}
	MakeApplicationK8sCompatible(wf)
	assert.Equal(t, "my-workflow-1", wf.Name)
}

func TestMakeApplicationK8sCompatible_SanitisesGenerateName(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{GenerateName: "My_Workflow-"}}
	MakeApplicationK8sCompatible(wf)
	assert.Equal(t, "my-workflow-", wf.GenerateName)
}

func TestMakeApplicationK8sCompatible_SanitisesLabels(t *testing.T) {
	wf := &wfv1.Workflow{
		ObjectMeta: metav1.ObjectMeta{
			Name:   "valid-name",
			Labels: map[string]string{"env": "Prod/US"},
		},
	}
	MakeApplicationK8sCompatible(wf)
	assert.Equal(t, "prod-us", wf.Labels["env"])
}

func TestMakeApplicationK8sCompatible_NilLabels(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: "my-wf", Labels: nil}}
	assert.NotPanics(t, func() { MakeApplicationK8sCompatible(wf) })
}

func TestMakeApplicationK8sCompatible_TruncatesLongName(t *testing.T) {
	long := "abcdefghijklmnopqrstuvwxyz-abcdefghijklmnopqrstuvwxyz-abcdefghijklmnopqrstuvwxyz"
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: long}}
	MakeApplicationK8sCompatible(wf)
	assert.LessOrEqual(t, len(wf.Name), 63)
}

// ----- BuildArgoLinks -----

func TestBuildArgoLinks_WithHttpsPrefix(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: "my-wf", Namespace: "argo"}}
	links := BuildArgoLinks("https://argo.example.com", wf)
	assert.Contains(t, links["ctrlplane/links"], "https://argo.example.com/workflows/argo/my-wf")
}

func TestBuildArgoLinks_AddsHttpsWhenMissing(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: "my-wf", Namespace: "argo"}}
	links := BuildArgoLinks("argo.example.com", wf)
	assert.True(t, len(links["ctrlplane/links"]) > 0)
	assert.Contains(t, links["ctrlplane/links"], "https://")
}

func TestBuildArgoLinks_ContainsWorkflowName(t *testing.T) {
	wf := &wfv1.Workflow{ObjectMeta: metav1.ObjectMeta{Name: "deploy-abc123", Namespace: "ci"}}
	links := BuildArgoLinks("https://argo.internal", wf)
	assert.Contains(t, links["ctrlplane/links"], "deploy-abc123")
	assert.Contains(t, links["ctrlplane/links"], "ci")
}

// ----- getK8sCompatibleName -----

func TestGetK8sCompatibleName(t *testing.T) {
	type inputParams struct {
		input    string
		generate bool
	}
	tests := []struct {
		name   string
		input  inputParams
		expect string
	}{
		{"lowercase passthrough", inputParams{"hello-world", false}, "hello-world"},
		{"uppercase lowercased", inputParams{"Hello-World", false}, "hello-world"},
		{"spaces replaced", inputParams{"hello world", false}, "hello-world"},
		{"underscores replaced", inputParams{"hello_world", false}, "hello-world"},
		{"slashes replaced", inputParams{"hello/world", false}, "hello-world"},
		{"leading dashes trimmed", inputParams{"--hello", false}, "hello"},
		{"trailing dashes trimmed", inputParams{"hello--", false}, "hello"},
		{"numbers preserved", inputParams{"deploy-v1-2", false}, "deploy-v1-2"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, getK8sCompatibleName(tt.input.input, tt.input.generate))
		})
	}
}

func TestGetK8sCompatibleName_LongNameTruncatedTo63(t *testing.T) {
	long := "a" + fmt.Sprintf("%0*d", 70, 0) // 71 chars
	result := getK8sCompatibleName(long, false)
	assert.LessOrEqual(t, len(result), 63)
}
