package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockPlanner struct {
	result *types.PlanResult
	err    error

	calledAgentType   string
	calledDispatchCtx *oapi.DispatchContext
	calledState       json.RawMessage
}

func (m *mockPlanner) Plan(
	_ context.Context,
	agentType string,
	dispatchCtx *oapi.DispatchContext,
	state json.RawMessage,
) (*types.PlanResult, error) {
	m.calledAgentType = agentType
	m.calledDispatchCtx = dispatchCtx
	m.calledState = state
	return m.result, m.err
}

type completedCall struct {
	ID     uuid.UUID
	Status db.DeploymentPlanTargetStatus
	Params db.UpdateDeploymentPlanTargetResultCompletedParams
}

type stateCall struct {
	ID         uuid.UUID
	AgentState []byte
}

type mockStore struct {
	result db.DeploymentPlanTargetResult
	getErr error

	completedCalls []completedCall
	completedErr   error

	stateCalls []stateCall
	stateErr   error
}

func (m *mockStore) GetDeploymentPlanTargetResult(_ context.Context, id uuid.UUID) (db.DeploymentPlanTargetResult, error) {
	return m.result, m.getErr
}

func (m *mockStore) UpdateDeploymentPlanTargetResultCompleted(_ context.Context, arg db.UpdateDeploymentPlanTargetResultCompletedParams) error {
	m.completedCalls = append(m.completedCalls, completedCall{
		ID:     arg.ID,
		Status: arg.Status,
		Params: arg,
	})
	return m.completedErr
}

func (m *mockStore) UpdateDeploymentPlanTargetResultState(_ context.Context, arg db.UpdateDeploymentPlanTargetResultStateParams) error {
	m.stateCalls = append(m.stateCalls, stateCall{
		ID:         arg.ID,
		AgentState: arg.AgentState,
	})
	return m.stateErr
}

// --- helpers ---

func testDispatchContext(agentType string) []byte {
	dc := oapi.DispatchContext{
		JobAgent: oapi.JobAgent{
			Id:   uuid.New().String(),
			Type: agentType,
			Name: agentType,
		},
		JobAgentConfig: oapi.JobAgentConfig{"key": "value"},
	}
	b, _ := json.Marshal(dc)
	return b
}

func testItem(resultID uuid.UUID) reconcile.Item {
	return reconcile.Item{
		ID:          1,
		WorkspaceID: uuid.New().String(),
		Kind:        "deployment-plan-target-result",
		ScopeType:   "deployment-plan-target-result",
		ScopeID:     resultID.String(),
	}
}

func testResultRow(resultID uuid.UUID, agentType string, agentState []byte) db.DeploymentPlanTargetResult {
	return db.DeploymentPlanTargetResult{
		ID:              resultID,
		TargetID:        uuid.New(),
		DispatchContext: testDispatchContext(agentType),
		AgentState:      agentState,
		Status:          db.DeploymentPlanTargetStatusComputing,
		StartedAt:       pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
}

// --- tests ---

func TestProcess_InvalidScopeID(t *testing.T) {
	ctrl := NewController(&mockPlanner{}, &mockStore{})
	item := reconcile.Item{ScopeID: "not-a-uuid"}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse result id")
}

func TestProcess_GetResultError(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{getErr: fmt.Errorf("db connection failed")}
	ctrl := NewController(&mockPlanner{}, store)

	_, err := ctrl.Process(context.Background(), testItem(resultID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get plan target result")
}

func TestProcess_InvalidDispatchContext(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result: db.DeploymentPlanTargetResult{
			ID:              resultID,
			TargetID:        uuid.New(),
			DispatchContext: []byte("not valid json"),
			Status:          db.DeploymentPlanTargetStatusComputing,
		},
	}
	ctrl := NewController(&mockPlanner{}, store)

	_, err := ctrl.Process(context.Background(), testItem(resultID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal dispatch context")
}

func TestProcess_AgentNotPlannable(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result: testResultRow(resultID, "unknown-agent", nil),
	}
	planner := &mockPlanner{result: nil, err: nil}

	ctrl := NewController(planner, store)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, store.completedCalls, 1)
	assert.Equal(t, resultID, store.completedCalls[0].ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusUnsupported, store.completedCalls[0].Status)
}

func TestProcess_AgentNotPlannable_UpdateError(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result:       testResultRow(resultID, "unknown-agent", nil),
		completedErr: fmt.Errorf("update failed"),
	}
	planner := &mockPlanner{result: nil, err: nil}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "mark result unsupported")
}

func TestProcess_AgentPlanError(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result: testResultRow(resultID, "argo-cd", nil),
	}
	planner := &mockPlanner{err: fmt.Errorf("connection refused")}

	ctrl := NewController(planner, store)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, store.completedCalls, 1)
	assert.Equal(t, resultID, store.completedCalls[0].ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusErrored, store.completedCalls[0].Status)
}

func TestProcess_AgentPlanError_UpdateError(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result:       testResultRow(resultID, "argo-cd", nil),
		completedErr: fmt.Errorf("update failed"),
	}
	planner := &mockPlanner{err: fmt.Errorf("connection refused")}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "mark result errored")
	assert.Contains(t, err.Error(), "connection refused")
}

func TestProcess_Incomplete_SavesStateAndRequeues(t *testing.T) {
	resultID := uuid.New()
	agentState := json.RawMessage(`{"tmpAppName":"my-app-plan-abc"}`)

	store := &mockStore{
		result: testResultRow(resultID, "argo-cd", nil),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{
			CompletedAt: nil,
			State:       agentState,
		},
	}

	ctrl := NewController(planner, store)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, requeueDelay, res.RequeueAfter)

	require.Len(t, store.stateCalls, 1)
	assert.Equal(t, resultID, store.stateCalls[0].ID)
	assert.Equal(t, []byte(agentState), store.stateCalls[0].AgentState)
	assert.Empty(t, store.completedCalls)
}

func TestProcess_Incomplete_SaveStateError(t *testing.T) {
	resultID := uuid.New()
	store := &mockStore{
		result:   testResultRow(resultID, "argo-cd", nil),
		stateErr: fmt.Errorf("write failed"),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{CompletedAt: nil, State: json.RawMessage(`{}`)},
	}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "save agent state")
}

func TestProcess_Completed_WithChanges(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	store := &mockStore{
		result: testResultRow(resultID, "argo-cd", nil),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{
			CompletedAt: &now,
			HasChanges:  true,
			ContentHash: "abc123",
			Current:     "old-manifest",
			Proposed:    "new-manifest",
		},
	}

	ctrl := NewController(planner, store)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	assert.Empty(t, store.stateCalls)

	require.Len(t, store.completedCalls, 1)
	call := store.completedCalls[0]
	assert.Equal(t, resultID, call.ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusCompleted, call.Status)

	assert.True(t, call.Params.HasChanges.Valid)
	assert.True(t, call.Params.HasChanges.Bool)
	assert.Equal(t, "abc123", call.Params.ContentHash.String)
	assert.True(t, call.Params.ContentHash.Valid)
	assert.Equal(t, "old-manifest", call.Params.Current.String)
	assert.Equal(t, "new-manifest", call.Params.Proposed.String)
}

func TestProcess_Completed_NoChanges(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	store := &mockStore{
		result: testResultRow(resultID, "test-runner", nil),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{
			CompletedAt: &now,
			HasChanges:  false,
			ContentHash: "test-runner",
		},
	}

	ctrl := NewController(planner, store)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)

	require.Len(t, store.completedCalls, 1)
	call := store.completedCalls[0]
	assert.Equal(t, db.DeploymentPlanTargetStatusCompleted, call.Status)
	assert.True(t, call.Params.HasChanges.Valid)
	assert.False(t, call.Params.HasChanges.Bool)
}

func TestProcess_Completed_SaveError(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	store := &mockStore{
		result:       testResultRow(resultID, "argo-cd", nil),
		completedErr: fmt.Errorf("write failed"),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{
			CompletedAt: &now,
			HasChanges:  true,
		},
	}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "save completed result")
}

func TestProcess_PassesExistingAgentState(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	savedState := json.RawMessage(`{"tmpAppName":"my-app-plan-xyz"}`)

	store := &mockStore{
		result: testResultRow(resultID, "argo-cd", savedState),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{CompletedAt: &now},
	}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, "argo-cd", planner.calledAgentType)
	assert.Equal(t, json.RawMessage(savedState), planner.calledState)
}

func TestProcess_ExtractsAgentTypeFromDispatchContext(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	store := &mockStore{
		result: testResultRow(resultID, "test-runner", nil),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{CompletedAt: &now},
	}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, "test-runner", planner.calledAgentType)
}

func TestProcess_ContentHash_EmptyIsNotStored(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	store := &mockStore{
		result: testResultRow(resultID, "test-runner", nil),
	}
	planner := &mockPlanner{
		result: &types.PlanResult{
			CompletedAt: &now,
			ContentHash: "",
		},
	}

	ctrl := NewController(planner, store)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	require.Len(t, store.completedCalls, 1)
	assert.False(t, store.completedCalls[0].Params.ContentHash.Valid)
}
