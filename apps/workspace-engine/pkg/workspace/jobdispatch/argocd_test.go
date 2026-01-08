package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"
	"text/template"
	"time"

	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/Masterminds/sprig/v3"
	applicationpkg "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestGetK8sCompatibleName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple name unchanged",
			input:    "my-app",
			expected: "my-app",
		},
		{
			name:     "replaces slashes with hyphens",
			input:    "namespace/app-name",
			expected: "namespace-app-name",
		},
		{
			name:     "replaces colons with hyphens",
			input:    "app:version:1",
			expected: "app-version-1",
		},
		{
			name:     "replaces multiple special chars",
			input:    "namespace/app:v1",
			expected: "namespace-app-v1",
		},
		{
			name:     "trims leading hyphens",
			input:    "-my-app",
			expected: "my-app",
		},
		{
			name:     "trims trailing hyphens",
			input:    "my-app-",
			expected: "my-app",
		},
		{
			name:     "trims leading underscores",
			input:    "_my-app",
			expected: "my-app",
		},
		{
			name:     "trims trailing underscores",
			input:    "my-app_",
			expected: "my-app",
		},
		{
			name:     "trims leading dots",
			input:    ".my-app",
			expected: "my-app",
		},
		{
			name:     "trims trailing dots",
			input:    "my-app.",
			expected: "my-app",
		},
		{
			name:     "truncates to 63 characters",
			input:    "this-is-a-very-long-name-that-exceeds-the-kubernetes-limit-of-63-characters",
			expected: "this-is-a-very-long-name-that-exceeds-the-kubernetes-limit-of-6",
		},
		{
			name:     "handles combination of issues",
			input:    "-namespace/app:version-",
			expected: "namespace-app-version",
		},
		{
			name:     "empty after trimming returns empty",
			input:    "---",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getK8sCompatibleName(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestUnmarshalApplication(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
		expectName  string
	}{
		{
			name: "valid YAML",
			input: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/repo
    path: manifests
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: default`,
			expectError: false,
			expectName:  "my-app",
		},
		{
			name:        "valid JSON",
			input:       `{"apiVersion":"argoproj.io/v1alpha1","kind":"Application","metadata":{"name":"json-app","namespace":"argocd"},"spec":{"project":"default"}}`,
			expectError: false,
			expectName:  "json-app",
		},
		{
			name: "YAML with labels",
			input: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: labeled-app
  labels:
    env: production
    version: v1.0.0`,
			expectError: false,
			expectName:  "labeled-app",
		},
		{
			name:        "invalid content",
			input:       `not valid yaml or json {{{`,
			expectError: true,
			expectName:  "",
		},
		{
			name:        "empty input",
			input:       ``,
			expectError: false,
			expectName:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var app v1alpha1.Application
			err := unmarshalApplication([]byte(tt.input), &app)

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectName, app.ObjectMeta.Name)
			}
		})
	}
}

func TestIsRetryableError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "502 error",
			err:      errors.New("server returned 502 Bad Gateway"),
			expected: true,
		},
		{
			name:     "503 error",
			err:      errors.New("server returned 503 Service Unavailable"),
			expected: true,
		},
		{
			name:     "504 error",
			err:      errors.New("server returned 504 Gateway Timeout"),
			expected: true,
		},
		{
			name:     "connection refused",
			err:      errors.New("dial tcp: connection refused"),
			expected: true,
		},
		{
			name:     "connection reset",
			err:      errors.New("read tcp: connection reset by peer"),
			expected: true,
		},
		{
			name:     "timeout error",
			err:      errors.New("request timeout exceeded"),
			expected: true,
		},
		{
			name:     "temporarily unavailable",
			err:      errors.New("service temporarily unavailable"),
			expected: true,
		},
		{
			name:     "404 not found - not retryable",
			err:      errors.New("server returned 404 Not Found"),
			expected: false,
		},
		{
			name:     "400 bad request - not retryable",
			err:      errors.New("server returned 400 Bad Request"),
			expected: false,
		},
		{
			name:     "401 unauthorized - not retryable",
			err:      errors.New("server returned 401 Unauthorized"),
			expected: false,
		},
		{
			name:     "generic error - not retryable",
			err:      errors.New("something went wrong"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isRetryableError(tt.err)
			require.Equal(t, tt.expected, result)
		})
	}
}

// Helper to execute a template with the same options as DispatchJob
func executeTemplate(templateStr string, data *oapi.TemplatableJob) (string, error) {
	t, err := template.New("test").Funcs(sprig.TxtFuncMap()).Option("missingkey=zero").Parse(templateStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// createTestTemplatableJob creates a TemplatableJob with test data
func createTestTemplatableJob() *oapi.TemplatableJob {
	now := time.Now()
	return &oapi.TemplatableJob{
		JobWithRelease: oapi.JobWithRelease{
			Job: oapi.Job{
				Id:        "job-123",
				ReleaseId: "release-456",
				Status:    oapi.JobStatusPending,
				CreatedAt: now,
				UpdatedAt: now,
				Metadata: map[string]string{
					"key1": "value1",
				},
			},
			Release: oapi.Release{
				CreatedAt: now.Format(time.RFC3339),
				ReleaseTarget: oapi.ReleaseTarget{
					DeploymentId:  "deployment-789",
					EnvironmentId: "env-abc",
					ResourceId:    "resource-def",
				},
				Version: oapi.DeploymentVersion{
					Id:   "version-001",
					Name: "v1.2.3",
				},
			},
			Resource: &oapi.Resource{
				Id:         "resource-def",
				Name:       "my-app",
				Identifier: "my-app-identifier",
				Kind:       "Kubernetes",
				Version:    "1.0.0",
				Config: map[string]interface{}{
					"namespace": "production",
					"cluster":   "us-west-2",
				},
				Metadata: map[string]string{
					"team": "platform",
				},
			},
			Environment: &oapi.Environment{
				Id:   "env-abc",
				Name: "production",
			},
			Deployment: &oapi.Deployment{
				Id:   "deployment-789",
				Name: "my-deployment",
			},
		},
		Release: &oapi.TemplatableRelease{
			Release: oapi.Release{
				CreatedAt: now.Format(time.RFC3339),
				ReleaseTarget: oapi.ReleaseTarget{
					DeploymentId:  "deployment-789",
					EnvironmentId: "env-abc",
					ResourceId:    "resource-def",
				},
				Version: oapi.DeploymentVersion{
					Id:   "version-001",
					Name: "v1.2.3",
				},
			},
			Variables: map[string]string{
				"IMAGE_TAG":  "v1.2.3",
				"REPLICAS":   "3",
				"EXTRA_ARGS": "--verbose",
			},
		},
	}
}

func TestTemplateExecution_BasicFields(t *testing.T) {
	job := createTestTemplatableJob()

	tests := []struct {
		name     string
		template string
		expected string
	}{
		{
			name:     "job id",
			template: `{{ .Job.Id }}`,
			expected: "job-123",
		},
		{
			name:     "resource name",
			template: `{{ .Resource.Name }}`,
			expected: "my-app",
		},
		{
			name:     "resource identifier",
			template: `{{ .Resource.Identifier }}`,
			expected: "my-app-identifier",
		},
		{
			name:     "environment name",
			template: `{{ .Environment.Name }}`,
			expected: "production",
		},
		{
			name:     "deployment name",
			template: `{{ .Deployment.Name }}`,
			expected: "my-deployment",
		},
		{
			name:     "release version name",
			template: `{{ .Release.Version.Name }}`,
			expected: "v1.2.3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := executeTemplate(tt.template, job)
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateExecution_ReleaseVariables(t *testing.T) {
	job := createTestTemplatableJob()

	tests := []struct {
		name     string
		template string
		expected string
	}{
		{
			name:     "access variable by key",
			template: `{{ index .Release.Variables "IMAGE_TAG" }}`,
			expected: "v1.2.3",
		},
		{
			name:     "access multiple variables",
			template: `tag={{ index .Release.Variables "IMAGE_TAG" }}, replicas={{ index .Release.Variables "REPLICAS" }}`,
			expected: "tag=v1.2.3, replicas=3",
		},
		{
			name:     "missing variable returns empty with missingkey=zero",
			template: `{{ index .Release.Variables "NONEXISTENT" }}`,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := executeTemplate(tt.template, job)
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateExecution_ResourceConfig(t *testing.T) {
	job := createTestTemplatableJob()

	tests := []struct {
		name     string
		template string
		expected string
	}{
		{
			name:     "access config value",
			template: `{{ index .Resource.Config "namespace" }}`,
			expected: "production",
		},
		{
			name:     "access nested config",
			template: `{{ index .Resource.Config "cluster" }}`,
			expected: "us-west-2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := executeTemplate(tt.template, job)
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateExecution_SprigFunctions(t *testing.T) {
	job := createTestTemplatableJob()

	tests := []struct {
		name     string
		template string
		expected string
	}{
		{
			name:     "lower function",
			template: `{{ .Resource.Name | lower }}`,
			expected: "my-app",
		},
		{
			name:     "upper function",
			template: `{{ .Resource.Name | upper }}`,
			expected: "MY-APP",
		},
		{
			name:     "replace function",
			template: `{{ .Resource.Name | replace "-" "_" }}`,
			expected: "my_app",
		},
		{
			name:     "default function for missing value",
			template: `{{ index .Release.Variables "MISSING" | default "default-value" }}`,
			expected: "default-value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := executeTemplate(tt.template, job)
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateExecution_FullArgoCDApplication(t *testing.T) {
	job := createTestTemplatableJob()

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {{ .Resource.Name }}
  namespace: argocd
  labels:
    app: {{ .Resource.Name }}
    env: {{ .Environment.Name }}
spec:
  project: default
  source:
    repoURL: https://github.com/example/repo
    path: manifests/{{ .Environment.Name }}
    targetRevision: {{ index .Release.Variables "IMAGE_TAG" }}
  destination:
    server: https://kubernetes.default.svc
    namespace: {{ index .Resource.Config "namespace" }}`

	result, err := executeTemplate(templateStr, job)
	require.NoError(t, err)

	// Verify the template rendered correctly
	require.Contains(t, result, "name: my-app")
	require.Contains(t, result, "env: production")
	require.Contains(t, result, "path: manifests/production")
	require.Contains(t, result, "targetRevision: v1.2.3")
	require.Contains(t, result, "namespace: production")

	// Verify it can be unmarshaled as an ArgoCD Application
	var app v1alpha1.Application
	err = unmarshalApplication([]byte(result), &app)
	require.NoError(t, err)
	require.Equal(t, "my-app", app.ObjectMeta.Name)
	require.Equal(t, "argocd", app.ObjectMeta.Namespace)
	require.Equal(t, "my-app", app.ObjectMeta.Labels["app"])
	require.Equal(t, "production", app.ObjectMeta.Labels["env"])
}

func TestTemplateExecution_NilResource(t *testing.T) {
	job := createTestTemplatableJob()
	job.Resource = nil

	// With missingkey=zero, accessing nil resource should not panic
	templateStr := `name: {{ if .Resource }}{{ .Resource.Name }}{{ else }}unknown{{ end }}`
	result, err := executeTemplate(templateStr, job)
	require.NoError(t, err)
	require.Equal(t, "name: unknown", result)
}

func TestTemplateExecution_InvalidTemplate(t *testing.T) {
	job := createTestTemplatableJob()

	invalidTemplates := []struct {
		name     string
		template string
	}{
		{
			name:     "unclosed action",
			template: `{{ .Job.Id`,
		},
		{
			name:     "unknown function",
			template: `{{ nonexistentFunc .Job.Id }}`,
		},
	}

	for _, tt := range invalidTemplates {
		t.Run(tt.name, func(t *testing.T) {
			_, err := executeTemplate(tt.template, job)
			require.Error(t, err)
		})
	}
}

// Mock implementations for testing DispatchJob

type mockArgoCDClient struct {
	createdApps []*applicationpkg.ApplicationCreateRequest
	createErr   error
}

func (m *mockArgoCDClient) Create(ctx context.Context, req *applicationpkg.ApplicationCreateRequest, opts ...grpc.CallOption) (*v1alpha1.Application, error) {
	if m.createErr != nil {
		return nil, m.createErr
	}
	m.createdApps = append(m.createdApps, req)
	return req.Application, nil
}

type mockKafkaProducer struct {
	publishedMessages []publishedMessage
	publishErr        error
	closed            bool
}

type publishedMessage struct {
	key   []byte
	value []byte
}

func (m *mockKafkaProducer) Publish(key, value []byte) error {
	if m.publishErr != nil {
		return m.publishErr
	}
	m.publishedMessages = append(m.publishedMessages, publishedMessage{key: key, value: value})
	return nil
}

func (m *mockKafkaProducer) PublishToPartition(key, value []byte, partition int32) error {
	return m.Publish(key, value)
}

func (m *mockKafkaProducer) Flush(timeoutMs int) int {
	return 0
}

func (m *mockKafkaProducer) Close() error {
	m.closed = true
	return nil
}

// Ensure mockKafkaProducer implements messaging.Producer
var _ messaging.Producer = (*mockKafkaProducer)(nil)

type mockVerificationStarter struct {
	startedVerifications []startedVerification
	startErr             error
}

type startedVerification struct {
	job     *oapi.Job
	metrics []oapi.VerificationMetricSpec
}

func (m *mockVerificationStarter) StartVerification(ctx context.Context, job *oapi.Job, metrics []oapi.VerificationMetricSpec) error {
	if m.startErr != nil {
		return m.startErr
	}
	m.startedVerifications = append(m.startedVerifications, startedVerification{
		job:     job,
		metrics: metrics,
	})
	return nil
}

// Helper to create a test store with job, release, and resource data
func createTestStore(t *testing.T) *store.Store {
	sc := statechange.NewChangeSet[any]()
	s := store.New("test-workspace", sc)

	ctx := context.Background()

	// Create environment
	s.Environments.Upsert(ctx, &oapi.Environment{
		Id:   "env-abc",
		Name: "production",
	})

	// Create deployment
	s.Deployments.Upsert(ctx, &oapi.Deployment{
		Id:   "deployment-789",
		Name: "my-deployment",
	})

	// Create resource
	s.Resources.Upsert(ctx, &oapi.Resource{
		Id:         "resource-def",
		Name:       "my-app",
		Identifier: "my-app-identifier",
		Kind:       "Kubernetes",
		Version:    "1.0.0",
		Config: map[string]interface{}{
			"namespace": "production",
		},
		Metadata: map[string]string{
			"team": "platform",
		},
	})

	// Create release
	now := time.Now()
	s.Releases.Upsert(ctx, &oapi.Release{
		CreatedAt: now.Format(time.RFC3339),
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  "deployment-789",
			EnvironmentId: "env-abc",
			ResourceId:    "resource-def",
		},
		Version: oapi.DeploymentVersion{
			Id:   "version-001",
			Name: "v1.2.3",
		},
	})

	// Create job - get the release ID from the releases map
	var releaseId string
	for _, release := range s.Releases.Items() {
		releaseId = release.ID()
		break
	}
	s.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-123",
		ReleaseId: releaseId,
		Status:    oapi.JobStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	})

	return s
}

// Helper to create a job config
func createArgoCDJobConfig(t *testing.T, templateStr string) oapi.FullJobAgentConfig {
	configPayload := oapi.FullArgoCDJobAgentConfig{
		Type:      "argo-cd",
		ServerUrl: "argocd.example.com",
		ApiKey:    "test-api-key",
		Template:  templateStr,
	}

	configJSON, err := json.Marshal(configPayload)
	require.NoError(t, err)

	config := oapi.FullJobAgentConfig{}
	err = config.UnmarshalJSON(configJSON)
	require.NoError(t, err)

	return config
}

func TestArgoCDDispatcher_DispatchJob_Success(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			require.Equal(t, "argocd.example.com", serverAddr)
			require.Equal(t, "test-api-key", authToken)
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {{ .Resource.Name }}
  namespace: argocd
  labels:
    env: {{ .Environment.Name }}
spec:
  project: default
  source:
    repoURL: https://github.com/example/repo
    targetRevision: {{ .Release.Version.Name }}
  destination:
    server: https://kubernetes.default.svc
    namespace: production`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Verify ArgoCD client was called
	require.Len(t, mockClient.createdApps, 1)
	createdApp := mockClient.createdApps[0]
	require.NotNil(t, createdApp.Application)
	require.Equal(t, "my-app", createdApp.Application.ObjectMeta.Name)
	require.Equal(t, "argocd", createdApp.Application.ObjectMeta.Namespace)
	require.Equal(t, "production", createdApp.Application.ObjectMeta.Labels["env"])
	require.True(t, *createdApp.Upsert)

	// Verify Kafka message was published
	require.Len(t, mockProducer.publishedMessages, 1)
	require.True(t, mockProducer.closed)

	// Verify verification was started
	require.Len(t, mockVerifier.startedVerifications, 1)
	require.Equal(t, "job-123", mockVerifier.startedVerifications[0].job.Id)
}

func TestArgoCDDispatcher_DispatchJob_CleansApplicationName(t *testing.T) {
	testStore := createTestStore(t)

	// Update the resource name to include invalid characters
	ctx := context.Background()
	testStore.Resources.Upsert(ctx, &oapi.Resource{
		Id:         "resource-def",
		Name:       "namespace/my-app:v1",
		Identifier: "my-app-identifier",
		Kind:       "Kubernetes",
		Version:    "1.0.0",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	})

	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {{ .Resource.Name }}
  namespace: argocd
  labels:
    original-name: {{ .Resource.Name }}`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Verify the application name was cleaned
	require.Len(t, mockClient.createdApps, 1)
	createdApp := mockClient.createdApps[0]
	require.Equal(t, "namespace-my-app-v1", createdApp.Application.ObjectMeta.Name)
	// Labels should also be cleaned
	require.Equal(t, "namespace-my-app-v1", createdApp.Application.ObjectMeta.Labels["original-name"])
}

func TestArgoCDDispatcher_DispatchJob_MissingResource(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	testStore := store.New("test-workspace", sc)

	ctx := context.Background()

	// Create environment, deployment, but NOT resource
	testStore.Environments.Upsert(ctx, &oapi.Environment{
		Id:   "env-abc",
		Name: "production",
	})
	testStore.Deployments.Upsert(ctx, &oapi.Deployment{
		Id:   "deployment-789",
		Name: "my-deployment",
	})

	// Create release without resource
	now := time.Now()
	testStore.Releases.Upsert(ctx, &oapi.Release{
		CreatedAt: now.Format(time.RFC3339),
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  "deployment-789",
			EnvironmentId: "env-abc",
			ResourceId:    "nonexistent-resource",
		},
		Version: oapi.DeploymentVersion{
			Id:   "version-001",
			Name: "v1.2.3",
		},
	})

	var releaseId string
	for _, release := range testStore.Releases.Items() {
		releaseId = release.ID()
		break
	}
	testStore.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-123",
		ReleaseId: releaseId,
		Status:    oapi.JobStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	})

	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: test-app`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      releaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.Error(t, err)
	require.Contains(t, err.Error(), "resource not found")

	// Verify ArgoCD client was NOT called
	require.Len(t, mockClient.createdApps, 0)
}

func TestArgoCDDispatcher_DispatchJob_InvalidTemplate(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	// Invalid template syntax
	templateStr := `{{ .Resource.Name`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to parse template")

	// Verify ArgoCD client was NOT called
	require.Len(t, mockClient.createdApps, 0)
}

func TestArgoCDDispatcher_DispatchJob_MissingApplicationName(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	// Template that produces valid YAML but without metadata.name
	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  namespace: argocd
spec:
  project: default`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.Error(t, err)
	require.Contains(t, err.Error(), "application name is required")

	// Verify ArgoCD client was NOT called
	require.Len(t, mockClient.createdApps, 0)
}

func TestArgoCDDispatcher_DispatchJob_ArgoCDClientError(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{
		createErr: errors.New("ArgoCD server error 500"),
	}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to create ArgoCD application")

	// Verify Kafka message was NOT published (since ArgoCD failed)
	require.Len(t, mockProducer.publishedMessages, 0)
}

func TestArgoCDDispatcher_DispatchJob_VerificationContinuesOnError(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{
		startErr: errors.New("verification error"),
	}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	// Dispatch should succeed even if verification fails (it's logged but not returned)
	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// ArgoCD client was still called
	require.Len(t, mockClient.createdApps, 1)

	// Kafka message was still published
	require.Len(t, mockProducer.publishedMessages, 1)
}

func TestArgoCDDispatcher_SendJobUpdateEvent_PublishesCorrectEvent(t *testing.T) {
	testStore := createTestStore(t)
	mockClient := &mockArgoCDClient{}
	mockProducer := &mockKafkaProducer{}
	mockVerifier := &mockVerificationStarter{}

	dispatcher := NewArgoCDDispatcherWithFactories(
		testStore,
		mockVerifier,
		func(serverAddr, authToken string) (ArgoCDApplicationClient, error) {
			return mockClient, nil
		},
		func() (messaging.Producer, error) {
			return mockProducer, nil
		},
	)

	templateStr := `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd`

	config := createArgoCDJobConfig(t, templateStr)

	job := &oapi.Job{
		Id:             "job-123",
		ReleaseId:      testStore.Jobs.Items()["job-123"].ReleaseId,
		JobAgentConfig: config,
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	require.NoError(t, err)

	// Verify the published message structure
	require.Len(t, mockProducer.publishedMessages, 1)
	msg := mockProducer.publishedMessages[0]

	// Key should be workspace ID
	require.Equal(t, "test-workspace", string(msg.key))

	// Parse the event
	var event map[string]any
	err = json.Unmarshal(msg.value, &event)
	require.NoError(t, err)

	require.Equal(t, "job.updated", event["eventType"])
	require.Equal(t, "test-workspace", event["workspaceId"])

	data := event["data"].(map[string]any)
	require.Equal(t, "job-123", data["id"])

	jobData := data["job"].(map[string]any)
	require.Equal(t, "job-123", jobData["id"])
	require.Equal(t, "successful", jobData["status"])

	// Verify the links metadata
	metadata := jobData["metadata"].(map[string]any)
	linksJSON := metadata["ctrlplane/links"].(string)
	var links map[string]string
	err = json.Unmarshal([]byte(linksJSON), &links)
	require.NoError(t, err)
	require.Contains(t, links["ArgoCD Application"], "argocd.example.com")
	require.Contains(t, links["ArgoCD Application"], "my-app")
}
