package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedJobAgents(t *testing.T, actualJobAgents []*oapi.JobAgent, expectedJobAgents []*oapi.JobAgent) {
	t.Helper()
	if len(actualJobAgents) != len(expectedJobAgents) {
		t.Fatalf("expected %d job agents, got %d", len(expectedJobAgents), len(actualJobAgents))
	}
	for _, expected := range expectedJobAgents {
		var actual *oapi.JobAgent
		for _, aj := range actualJobAgents {
			if aj.Id == expected.Id {
				actual = aj
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected job agent with id %s not found", expected.Id)
			return
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected job agent id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Name != expected.Name {
			t.Fatalf("expected job agent name %s, got %s", expected.Name, actual.Name)
		}
		if actual.Type != expected.Type {
			t.Fatalf("expected job agent type %s, got %s", expected.Type, actual.Type)
		}
		if actual.WorkspaceId != expected.WorkspaceId {
			t.Fatalf("expected job agent workspace_id %s, got %s", expected.WorkspaceId, actual.WorkspaceId)
		}

		// Validate config
		if len(actual.Config) != len(expected.Config) {
			t.Fatalf("expected %d config entries, got %d", len(expected.Config), len(actual.Config))
		}
		for key, expectedValue := range expected.Config {
			actualValue, ok := actual.Config[key]
			if !ok {
				t.Fatalf("expected config key %s not found", key)
			}
			if fmt.Sprintf("%v", actualValue) != fmt.Sprintf("%v", expectedValue) {
				t.Fatalf("expected config[%s] = %v, got %v", key, expectedValue, actualValue)
			}
		}
	}
}

func TestDBJobAgents_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-job-agent-%s", id[:8])
	jobAgent := &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        "kubernetes",
		Config: map[string]interface{}{
			"namespace": "default",
			"timeout":   300.0,
		},
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedJobAgents := []*oapi.JobAgent{jobAgent}
	actualJobAgents, err := getJobAgents(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobAgents(t, actualJobAgents, expectedJobAgents)
}

func TestDBJobAgents_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-job-agent-%s", id[:8])
	jobAgent := &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        "kubernetes",
		Config:      map[string]interface{}{},
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify job agent exists
	actualJobAgents, err := getJobAgents(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobAgents(t, actualJobAgents, []*oapi.JobAgent{jobAgent})

	// Delete job agent
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	err = deleteJobAgent(t.Context(), id, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify job agent is deleted
	actualJobAgents, err = getJobAgents(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobAgents(t, actualJobAgents, []*oapi.JobAgent{})
}

func TestDBJobAgents_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-job-agent-%s", id[:8])
	jobAgent := &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        "kubernetes",
		Config: map[string]interface{}{
			"key": "value",
		},
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update job agent
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	jobAgent.Name = name + "-updated"
	jobAgent.Type = "docker"
	jobAgent.Config = map[string]interface{}{
		"key":  "value-updated",
		"new":  "config",
		"port": 8080.0,
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualJobAgents, err := getJobAgents(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobAgents(t, actualJobAgents, []*oapi.JobAgent{jobAgent})
}

func TestDBJobAgents_ComplexConfig(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-job-agent-%s", id[:8])
	jobAgent := &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        "custom",
		Config: map[string]interface{}{
			"string": "value",
			"number": 42.0,
			"bool":   true,
			"nested": map[string]interface{}{
				"key": "value",
			},
			"array": []interface{}{"item1", "item2"},
		},
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify
	actualJobAgents, err := getJobAgents(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobAgents(t, actualJobAgents, []*oapi.JobAgent{jobAgent})
}

func TestDBJobAgents_NonexistentWorkspaceThrowsError(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	jobAgent := &oapi.JobAgent{
		Id:          uuid.New().String(),
		WorkspaceId: uuid.New().String(), // Non-existent workspace
		Name:        "test-job-agent",
		Type:        "kubernetes",
		Config:      map[string]interface{}{},
	}

	err = writeJobAgent(t.Context(), jobAgent, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}
}

func TestDBJobAgents_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)

	// Create job agent in workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx1.Rollback(t.Context()) }()

	jobAgent1 := &oapi.JobAgent{
		Id:          uuid.New().String(),
		WorkspaceId: workspaceID1,
		Name:        "workspace1-job-agent",
		Type:        "kubernetes",
		Config:      map[string]interface{}{"workspace": "1"},
	}

	err = writeJobAgent(t.Context(), jobAgent1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create job agent in workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx2.Rollback(t.Context()) }()

	jobAgent2 := &oapi.JobAgent{
		Id:          uuid.New().String(),
		WorkspaceId: workspaceID2,
		Name:        "workspace2-job-agent",
		Type:        "docker",
		Config:      map[string]interface{}{"workspace": "2"},
	}

	err = writeJobAgent(t.Context(), jobAgent2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify workspace 1 only sees its own job agent
	jobAgents1, err := getJobAgents(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(jobAgents1) != 1 {
		t.Fatalf("expected 1 job agent in workspace 1, got %d", len(jobAgents1))
	}
	if jobAgents1[0].Id != jobAgent1.Id {
		t.Fatalf("expected job agent %s in workspace 1, got %s", jobAgent1.Id, jobAgents1[0].Id)
	}

	// Verify workspace 2 only sees its own job agent
	jobAgents2, err := getJobAgents(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(jobAgents2) != 1 {
		t.Fatalf("expected 1 job agent in workspace 2, got %d", len(jobAgents2))
	}
	if jobAgents2[0].Id != jobAgent2.Id {
		t.Fatalf("expected job agent %s in workspace 2, got %s", jobAgent2.Id, jobAgents2[0].Id)
	}
}
