package jobdispatch

import (
	"context"
	"os"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/require"
)

// mockGithubClient stores dispatched workflows for validation
type mockGithubClient struct {
	dispatchedWorkflows []DispatchedWorkflow
}

type DispatchedWorkflow struct {
	Owner      string
	Repo       string
	WorkflowID int64
	Ref        string
	Inputs     map[string]any
}

func (m *mockGithubClient) DispatchWorkflow(ctx context.Context, owner, repo string, workflowID int64, ref string, inputs map[string]any) error {
	m.dispatchedWorkflows = append(m.dispatchedWorkflows, DispatchedWorkflow{
		Owner:      owner,
		Repo:       repo,
		WorkflowID: workflowID,
		Ref:        ref,
		Inputs:     inputs,
	})
	return nil
}

func TestGithubDispatcher_DispatchJob_Success(t *testing.T) {
	// Setup mock repository with GitHub entity
	mockStore := store.New()
	if err := mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
		InstallationId: 12345,
		Slug:           "test-owner",
	}); err != nil {
		t.Fatalf("Failed to upsert GitHub entity: %v", err)
	}

	// Setup mock client
	mockClient := &mockGithubClient{}

	// Create dispatcher with mock client factory
	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	// Create test job
	job := &oapi.Job{
		Id: "test-job-123",
		JobAgentConfig: map[string]any{
			"installationId": float64(12345),
			"owner":          "test-owner",
			"repo":           "test-repo",
			"workflowId":     float64(456),
		},
	}

	// Dispatch the job
	err := dispatcher.DispatchJob(context.Background(), job)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Validate the dispatched workflow
	if len(mockClient.dispatchedWorkflows) != 1 {
		t.Fatalf("Expected 1 dispatched workflow, got %d", len(mockClient.dispatchedWorkflows))
	}

	dispatched := mockClient.dispatchedWorkflows[0]
	if dispatched.Owner != "test-owner" {
		t.Errorf("Expected owner 'test-owner', got '%s'", dispatched.Owner)
	}
	if dispatched.Repo != "test-repo" {
		t.Errorf("Expected repo 'test-repo', got '%s'", dispatched.Repo)
	}
	if dispatched.WorkflowID != 456 {
		t.Errorf("Expected workflowID 456, got %d", dispatched.WorkflowID)
	}
	if dispatched.Ref != "main" {
		t.Errorf("Expected ref 'main', got '%s'", dispatched.Ref)
	}
	if dispatched.Inputs["job_id"] != "test-job-123" {
		t.Errorf("Expected job_id 'test-job-123', got '%v'", dispatched.Inputs["job_id"])
	}
}

func TestGithubDispatcher_DispatchJob_WithCustomRef(t *testing.T) {
	mockStore := store.New()
	if err := mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
		InstallationId: 12345,
		Slug:           "test-owner",
	}); err != nil {
		t.Fatalf("Failed to upsert GitHub entity: %v", err)
	}

	mockClient := &mockGithubClient{}

	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	customRef := "develop"
	job := &oapi.Job{
		Id: "test-job-456",
		JobAgentConfig: map[string]any{
			"installationId": float64(12345),
			"owner":          "test-owner",
			"repo":           "test-repo",
			"workflowId":     float64(789),
			"ref":            customRef,
		},
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if len(mockClient.dispatchedWorkflows) != 1 {
		t.Fatalf("Expected 1 dispatched workflow, got %d", len(mockClient.dispatchedWorkflows))
	}

	dispatched := mockClient.dispatchedWorkflows[0]
	if dispatched.Ref != "develop" {
		t.Errorf("Expected ref 'develop', got '%s'", dispatched.Ref)
	}
}

func TestGithubDispatcher_DispatchJob_EntityNotFound(t *testing.T) {
	mockStore := store.New()

	mockClient := &mockGithubClient{}

	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	job := &oapi.Job{
		Id: "test-job-789",
		JobAgentConfig: map[string]any{
			"installationId": float64(99999),
			"owner":          "nonexistent-owner",
			"repo":           "test-repo",
			"workflowId":     float64(123),
		},
	}

	err := dispatcher.DispatchJob(context.Background(), job)
	if err == nil {
		t.Fatal("Expected error for missing GitHub entity, got nil")
	}

	expectedErr := "github entity not found"
	if len(err.Error()) < len(expectedErr) || err.Error()[:len(expectedErr)] != expectedErr {
		t.Errorf("Expected error containing '%s', got: %v", expectedErr, err)
	}

	// Should not have dispatched anything
	if len(mockClient.dispatchedWorkflows) != 0 {
		t.Errorf("Expected 0 dispatched workflows, got %d", len(mockClient.dispatchedWorkflows))
	}
}

func TestGithubDispatcher_ParseConfig(t *testing.T) {
	tests := []struct {
		name          string
		jobConfig     map[string]any
		expected      githubJobConfig
		expectError   bool
		errorContains string
	}{
		{
			name: "valid config with all fields",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"repo":           "test-repo",
				"workflowId":     float64(123),
				"ref":            "develop",
			},
			expected: githubJobConfig{
				InstallationId: 12345,
				Owner:          "test-owner",
				Repo:           "test-repo",
				WorkflowId:     123,
				Ref:            strPtr("develop"),
			},
			expectError: false,
		},
		{
			name: "valid config without optional ref",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"repo":           "test-repo",
				"workflowId":     float64(123),
			},
			expected: githubJobConfig{
				InstallationId: 12345,
				Owner:          "test-owner",
				Repo:           "test-repo",
				WorkflowId:     123,
				Ref:            nil,
			},
			expectError: false,
		},
		{
			name: "missing installationId",
			jobConfig: map[string]any{
				"owner":      "test-owner",
				"repo":       "test-repo",
				"workflowId": float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: installationId",
		},
		{
			name: "missing owner",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"repo":           "test-repo",
				"workflowId":     float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: owner",
		},
		{
			name: "missing repo",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"workflowId":     float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: repo",
		},
		{
			name: "missing workflowId",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"repo":           "test-repo",
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: workflowId",
		},
		{
			name: "empty owner string",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "",
				"repo":           "test-repo",
				"workflowId":     float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: owner",
		},
		{
			name: "empty repo string",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"repo":           "",
				"workflowId":     float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: repo",
		},
		{
			name: "zero installationId",
			jobConfig: map[string]any{
				"installationId": float64(0),
				"owner":          "test-owner",
				"repo":           "test-repo",
				"workflowId":     float64(123),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: installationId",
		},
		{
			name: "zero workflowId",
			jobConfig: map[string]any{
				"installationId": float64(12345),
				"owner":          "test-owner",
				"repo":           "test-repo",
				"workflowId":     float64(0),
			},
			expectError:   true,
			errorContains: "missing required GitHub job config: workflowId",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dispatcher := &GithubDispatcher{}

			job := &oapi.Job{
				Id:             "test-job",
				JobAgentConfig: tt.jobConfig,
			}

			result, err := dispatcher.parseConfig(job)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if tt.expectError && err != nil && tt.errorContains != "" {
				if len(err.Error()) < len(tt.errorContains) || err.Error()[:len(tt.errorContains)] != tt.errorContains {
					t.Errorf("Expected error containing '%s', got: %v", tt.errorContains, err)
				}
			}

			if !tt.expectError {
				if result.InstallationId != tt.expected.InstallationId {
					t.Errorf("Expected InstallationId %d, got %d", tt.expected.InstallationId, result.InstallationId)
				}
				if result.Owner != tt.expected.Owner {
					t.Errorf("Expected Owner %s, got %s", tt.expected.Owner, result.Owner)
				}
				if result.Repo != tt.expected.Repo {
					t.Errorf("Expected Repo %s, got %s", tt.expected.Repo, result.Repo)
				}
				if result.WorkflowId != tt.expected.WorkflowId {
					t.Errorf("Expected WorkflowId %d, got %d", tt.expected.WorkflowId, result.WorkflowId)
				}
				if (result.Ref == nil) != (tt.expected.Ref == nil) {
					t.Errorf("Ref presence mismatch: expected %v, got %v", tt.expected.Ref, result.Ref)
				}
				if result.Ref != nil && tt.expected.Ref != nil && *result.Ref != *tt.expected.Ref {
					t.Errorf("Expected Ref %s, got %s", *tt.expected.Ref, *result.Ref)
				}
			}
		})
	}
}

func TestGithubDispatcher_GetGithubEntity(t *testing.T) {
	tests := []struct {
		name     string
		entities []struct {
			installationID int
			slug           string
		}
		searchCfg   githubJobConfig
		expectFound bool
	}{
		{
			name: "entity found",
			entities: []struct {
				installationID int
				slug           string
			}{
				{12345, "owner1"},
				{67890, "owner2"},
			},
			searchCfg: githubJobConfig{
				InstallationId: 12345,
				Owner:          "owner1",
			},
			expectFound: true,
		},
		{
			name: "entity not found - wrong installation ID",
			entities: []struct {
				installationID int
				slug           string
			}{
				{12345, "owner1"},
			},
			searchCfg: githubJobConfig{
				InstallationId: 99999,
				Owner:          "owner1",
			},
			expectFound: false,
		},
		{
			name: "entity not found - wrong owner",
			entities: []struct {
				installationID int
				slug           string
			}{
				{12345, "owner1"},
			},
			searchCfg: githubJobConfig{
				InstallationId: 12345,
				Owner:          "wrong-owner",
			},
			expectFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := store.New()
			if err := mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
				InstallationId: tt.entities[0].installationID,
				Slug:           tt.entities[0].slug,
			}); err != nil {
				t.Fatalf("Failed to upsert GitHub entity: %v", err)
			}

			// Add test entities
			for _, e := range tt.entities {
				if err := mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
					InstallationId: e.installationID,
					Slug:           e.slug,
				}); err != nil {
					t.Fatalf("Failed to upsert GitHub entity: %v", err)
				}
			}

			dispatcher := NewGithubDispatcher(mockStore)
			result, exists := dispatcher.store.GithubEntities.Get(tt.searchCfg.Owner, tt.searchCfg.InstallationId)

			if tt.expectFound {
				if !exists {
					t.Fatalf("Expected to find entity, but it was not found")
				}
				require.Equal(t, tt.searchCfg.InstallationId, result.InstallationId)
				require.Equal(t, tt.searchCfg.Owner, result.Slug)
			} else {
				if exists {
					t.Fatalf("Expected entity not to be found, but found: %+v", result)
				}
			}
		})
	}
}

func TestGithubDispatcher_GetEnv(t *testing.T) {
	dispatcher := &GithubDispatcher{}

	testKey := "TEST_GITHUB_VAR"
	testValue := "test-value-123"
	os.Setenv(testKey, testValue)
	defer os.Unsetenv(testKey)

	result := dispatcher.getEnv(testKey)
	if result != testValue {
		t.Errorf("Expected %s, got %s", testValue, result)
	}
}

func TestGithubDispatcher_CreateGithubClient_MissingEnvVars(t *testing.T) {
	oldAppID := os.Getenv("GITHUB_BOT_APP_ID")
	oldPrivateKey := os.Getenv("GITHUB_BOT_PRIVATE_KEY")
	defer func() {
		os.Setenv("GITHUB_BOT_APP_ID", oldAppID)
		os.Setenv("GITHUB_BOT_PRIVATE_KEY", oldPrivateKey)
	}()

	os.Setenv("GITHUB_BOT_APP_ID", "")
	os.Setenv("GITHUB_BOT_PRIVATE_KEY", "")

	dispatcher := &GithubDispatcher{}
	_, err := dispatcher.createGithubClient(12345)

	if err == nil {
		t.Error("Expected error for missing config, got nil")
	}

	expectedErr := "GitHub bot not configured"
	if len(err.Error()) < len(expectedErr) || err.Error()[:len(expectedErr)] != expectedErr {
		t.Errorf("Expected error containing '%s', got: %v", expectedErr, err)
	}
}

// Helper function
func strPtr(s string) *string {
	return &s
}
