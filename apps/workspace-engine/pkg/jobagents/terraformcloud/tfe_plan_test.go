package terraformcloud

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

// --- mocks ---

type mockWorkspaceSetup struct {
	workspaceID string
	err         error
}

func (m *mockWorkspaceSetup) Setup(_ context.Context, _ *oapi.DispatchContext) (string, error) {
	return m.workspaceID, m.err
}

type mockSpeculativeRunner struct {
	createRunID string
	createErr   error

	readStatus *RunStatus
	readErr    error

	planJSON []byte
	jsonErr  error
}

func (m *mockSpeculativeRunner) CreateSpeculativeRun(
	_ context.Context,
	_ *tfeConfig,
	_ string,
) (string, error) {
	return m.createRunID, m.createErr
}

func (m *mockSpeculativeRunner) ReadRunStatus(
	_ context.Context,
	_ *tfeConfig,
	_ string,
) (*RunStatus, error) {
	return m.readStatus, m.readErr
}

func (m *mockSpeculativeRunner) ReadPlanJSON(
	_ context.Context,
	_ *tfeConfig,
	_ string,
) ([]byte, error) {
	return m.planJSON, m.jsonErr
}

// --- helpers ---

func validPlanConfig() oapi.JobAgentConfig {
	return oapi.JobAgentConfig{
		"address":      "https://app.terraform.io",
		"token":        "test-token",
		"organization": "my-org",
		"template":     "name: test-ws",
		"webhookUrl":   "https://example.com/webhook",
	}
}

func planDispatchCtx() *oapi.DispatchContext {
	return &oapi.DispatchContext{
		JobAgentConfig: validPlanConfig(),
	}
}

// --- tests ---

func TestTFCPlanner_Type(t *testing.T) {
	p := NewTFCPlanner(&mockWorkspaceSetup{}, &mockSpeculativeRunner{})
	assert.Equal(t, "tfe", p.Type())
}

func TestPlan_BadConfig(t *testing.T) {
	p := NewTFCPlanner(&mockWorkspaceSetup{}, &mockSpeculativeRunner{})
	dctx := &oapi.DispatchContext{
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_, err := p.Plan(context.Background(), dctx, nil)
	require.Error(t, err)
}

func TestPlan_WorkspaceSetupFailure(t *testing.T) {
	ws := &mockWorkspaceSetup{err: fmt.Errorf("workspace upsert failed")}
	p := NewTFCPlanner(ws, &mockSpeculativeRunner{})

	_, err := p.Plan(context.Background(), planDispatchCtx(), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "setup workspace")
}

func TestPlan_CreateRunFailure(t *testing.T) {
	ws := &mockWorkspaceSetup{workspaceID: "ws-123"}
	runner := &mockSpeculativeRunner{createErr: fmt.Errorf("tfc unavailable")}
	p := NewTFCPlanner(ws, runner)

	_, err := p.Plan(context.Background(), planDispatchCtx(), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "create speculative run")
}

func TestPlan_CreateRun_ReturnsIncomplete(t *testing.T) {
	ws := &mockWorkspaceSetup{workspaceID: "ws-123"}
	runner := &mockSpeculativeRunner{createRunID: "run-abc123"}
	p := NewTFCPlanner(ws, runner)

	result, err := p.Plan(context.Background(), planDispatchCtx(), nil)
	require.NoError(t, err)
	assert.Nil(t, result.CompletedAt)
	assert.NotEmpty(t, result.State)
	assert.Contains(t, result.Message, "run-abc123")

	var s tfePlanState
	require.NoError(t, json.Unmarshal(result.State, &s))
	assert.Equal(t, "run-abc123", s.RunID)
	assert.Equal(t, 0, s.PollCount)
	assert.NotNil(t, s.FirstPolled)
}

func TestPlan_PollStillRunning_Requeues(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{Status: "planning"},
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   1,
		FirstPolled: &now,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	assert.Nil(t, result.CompletedAt)
	assert.NotEmpty(t, result.State)
	assert.Contains(t, result.Message, "Waiting for plan")

	var s tfePlanState
	require.NoError(t, json.Unmarshal(result.State, &s))
	assert.Equal(t, 2, s.PollCount)
}

func TestPlan_RunErrored_Completes(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{Status: "errored", IsErrored: true},
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   3,
		FirstPolled: &now,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt)
	assert.Contains(t, result.Message, "errored")
	assert.False(t, result.HasChanges)
}

func TestPlan_RunCanceled_Completes(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{Status: "canceled", IsErrored: true},
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   1,
		FirstPolled: &now,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt)
	assert.Contains(t, result.Message, "canceled")
}

func TestPlan_Timeout_Completes(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{Status: "planning"},
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	expired := time.Now().Add(-planTimeout - time.Minute)
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   50,
		FirstPolled: &expired,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt)
	assert.Contains(t, result.Message, "timed out")
}

func TestPlan_PlannedAndFinished_NoChanges(t *testing.T) {
	planJSON := []byte(`{"resource_changes":[]}`)
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{
			Status:               "planned_and_finished",
			IsFinished:           true,
			PlanID:               "plan-123",
			ResourceAdditions:    0,
			ResourceChanges:      0,
			ResourceDestructions: 0,
		},
		planJSON: planJSON,
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   2,
		FirstPolled: &now,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt)
	assert.False(t, result.HasChanges)
	assert.NotEmpty(t, result.ContentHash)
	assert.JSONEq(t, string(planJSON), result.Proposed)
	assert.Contains(t, result.Message, "+0 ~0 -0")
}

func TestPlan_PlannedAndFinished_WithChanges(t *testing.T) {
	planJSON := []byte(`{"resource_changes":[{"type":"aws_instance"}]}`)
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{
			Status:               "planned_and_finished",
			IsFinished:           true,
			PlanID:               "plan-456",
			ResourceAdditions:    2,
			ResourceChanges:      1,
			ResourceDestructions: 0,
		},
		planJSON: planJSON,
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   3,
		FirstPolled: &now,
	})

	result, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)
	require.NotNil(t, result.CompletedAt)
	assert.True(t, result.HasChanges)
	assert.NotEmpty(t, result.ContentHash)
	assert.Contains(t, result.Message, "+2 ~1 -0")
}

func TestPlan_ReadPlanJSONFailure(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{
			Status:     "planned_and_finished",
			IsFinished: true,
			PlanID:     "plan-789",
		},
		jsonErr: fmt.Errorf("plan output not available"),
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   1,
		FirstPolled: &now,
	})

	_, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read plan JSON")
}

func TestPlan_ReadRunFailure(t *testing.T) {
	runner := &mockSpeculativeRunner{
		readErr: fmt.Errorf("connection refused"),
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   1,
		FirstPolled: &now,
	})

	_, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read run")
}

func TestPlan_ContentHashDeterministic(t *testing.T) {
	planJSON := []byte(`{"resource_changes":[{"type":"aws_s3_bucket"}]}`)
	runner := &mockSpeculativeRunner{
		readStatus: &RunStatus{
			Status:               "planned_and_finished",
			IsFinished:           true,
			PlanID:               "plan-det",
			ResourceAdditions:    1,
			ResourceChanges:      0,
			ResourceDestructions: 0,
		},
		planJSON: planJSON,
	}
	p := NewTFCPlanner(&mockWorkspaceSetup{}, runner)

	now := time.Now()
	state, _ := json.Marshal(tfePlanState{
		RunID:       "run-abc123",
		PollCount:   1,
		FirstPolled: &now,
	})

	r1, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)

	r2, err := p.Plan(context.Background(), planDispatchCtx(), state)
	require.NoError(t, err)

	assert.Equal(t, r1.ContentHash, r2.ContentHash)
}
