package jobdispatch

import (
	"context"
	"os"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
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
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)
	mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
		InstallationId: 12345,
		Slug:           "test-owner",
	})

	// Setup mock client
	mockClient := &mockGithubClient{}

	// Create dispatcher with mock client factory
	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	configPayload := map[string]any{
		"installationId": 12345,
		"owner":          "test-owner",
		"repo":           "test-repo",
		"workflowId":     456,
	}

	// Create test job
	job := &oapi.Job{
		Id:             "test-job-123",
		JobAgentConfig: configPayload,
	}

	// Dispatch the job
	if err := dispatcher.DispatchJob(context.Background(), job); err != nil {
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
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)
	mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
		InstallationId: 12345,
		Slug:           "test-owner",
	})

	mockClient := &mockGithubClient{}

	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	customRef := "develop"
	configPayload := map[string]any{
		"installationId": 12345,
		"owner":          "test-owner",
		"repo":           "test-repo",
		"workflowId":     789,
		"ref":            customRef,
	}
	job := &oapi.Job{
		Id:             "test-job-456",
		JobAgentConfig: configPayload,
	}

	if err := dispatcher.DispatchJob(context.Background(), job); err != nil {
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
	sc := statechange.NewChangeSet[any]()
	mockStore := store.New("test-workspace", sc)

	mockClient := &mockGithubClient{}

	dispatcher := NewGithubDispatcherWithClientFactory(mockStore, func(installationID int) (GithubClient, error) {
		return mockClient, nil
	})

	configPayload := map[string]any{
		"installationId": 99999,
		"owner":          "nonexistent-owner",
		"repo":           "test-repo",
		"workflowId":     123,
	}
	job := &oapi.Job{
		Id:             "test-job-789",
		JobAgentConfig: configPayload,
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

func TestGithubDispatcher_GetGithubEntity(t *testing.T) {
	tests := []struct {
		name     string
		entities []struct {
			installationID int
			slug           string
		}
		searchCfg   map[string]any
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
			searchCfg: map[string]any{
				"installationId": 12345,
				"owner":          "owner1",
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
			searchCfg: map[string]any{
				"installationId": 99999,
				"owner":          "owner1",
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
			searchCfg: map[string]any{
				"installationId": 12345,
				"owner":          "wrong-owner",
			},
			expectFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sc := statechange.NewChangeSet[any]()
			mockStore := store.New("test-workspace", sc)
			mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
				InstallationId: tt.entities[0].installationID,
				Slug:           tt.entities[0].slug,
			})

			// Add test entities
			for _, e := range tt.entities {
				mockStore.GithubEntities.Upsert(context.Background(), &oapi.GithubEntity{
					InstallationId: e.installationID,
					Slug:           e.slug,
				})
			}

			dispatcher := NewGithubDispatcher(mockStore)
			result, exists := dispatcher.store.GithubEntities.Get(tt.searchCfg["owner"].(string), tt.searchCfg["installationId"].(int))

			if tt.expectFound {
				if !exists {
					t.Fatalf("Expected to find entity, but it was not found")
				}
				require.Equal(t, tt.searchCfg["installationId"].(int), result.InstallationId)
				require.Equal(t, tt.searchCfg["owner"].(string), result.Slug)
			} else {
				if exists {
					t.Fatalf("Expected entity not to be found, but found: %+v", result)
				}
			}
		})
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
