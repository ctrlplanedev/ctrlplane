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
	"workspace-engine/svc/controllers/jobdispatch/jobagents"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockAgent struct {
	agentType string
	result    *types.PlanResult
	err       error

	calledDispatchCtx *oapi.DispatchContext
	calledState       json.RawMessage
}

func (m *mockAgent) Type() string { return m.agentType }

func (m *mockAgent) Plan(
	_ context.Context,
	dispatchCtx *oapi.DispatchContext,
	state json.RawMessage,
) (*types.PlanResult, error) {
	m.calledDispatchCtx = dispatchCtx
	m.calledState = state
	return m.result, m.err
}

type mockGetter struct {
	result db.DeploymentPlanTargetResult
	err    error
}

func (m *mockGetter) GetDeploymentPlanTargetResult(_ context.Context, _ uuid.UUID) (db.DeploymentPlanTargetResult, error) {
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

type mockSetter struct {
	completedCalls []completedCall
	completedErr   error

	stateCalls []stateCall
	stateErr   error
}

func (m *mockSetter) UpdateDeploymentPlanTargetResultCompleted(_ context.Context, arg db.UpdateDeploymentPlanTargetResultCompletedParams) error {
	m.completedCalls = append(m.completedCalls, completedCall{
		ID:     arg.ID,
		Status: arg.Status,
		Params: arg,
	})
	return m.completedErr
}

func (m *mockSetter) UpdateDeploymentPlanTargetResultState(_ context.Context, arg db.UpdateDeploymentPlanTargetResultStateParams) error {
	m.stateCalls = append(m.stateCalls, stateCall{
		ID:         arg.ID,
		AgentState: arg.AgentState,
	})
	return m.stateErr
}

// --- helpers ---

func testRegistry(agents ...*mockAgent) *jobagents.Registry {
	r := jobagents.NewRegistry(nil)
	for _, a := range agents {
		r.Register(a)
	}
	return r
}

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
	ctrl := NewController(testRegistry(), &mockGetter{}, &mockSetter{})
	item := reconcile.Item{ScopeID: "not-a-uuid"}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse result id")
}

func TestProcess_GetResultError(t *testing.T) {
	resultID := uuid.New()
	getter := &mockGetter{err: fmt.Errorf("db connection failed")}
	ctrl := NewController(testRegistry(), getter, &mockSetter{})

	_, err := ctrl.Process(context.Background(), testItem(resultID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get plan target result")
}

func TestProcess_InvalidDispatchContext(t *testing.T) {
	resultID := uuid.New()
	getter := &mockGetter{
		result: db.DeploymentPlanTargetResult{
			ID:              resultID,
			TargetID:        uuid.New(),
			DispatchContext: []byte("not valid json"),
			Status:          db.DeploymentPlanTargetStatusComputing,
		},
	}
	ctrl := NewController(testRegistry(), getter, &mockSetter{})

	_, err := ctrl.Process(context.Background(), testItem(resultID))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshal dispatch context")
}

func TestProcess_AgentNotPlannable(t *testing.T) {
	resultID := uuid.New()
	getter := &mockGetter{result: testResultRow(resultID, "unknown-agent", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(), getter, setter)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.completedCalls, 1)
	assert.Equal(t, resultID, setter.completedCalls[0].ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusUnsupported, setter.completedCalls[0].Status)
	assert.True(t, setter.completedCalls[0].Params.Message.Valid)
	assert.Contains(t, setter.completedCalls[0].Params.Message.String, "unknown-agent")
}

func TestProcess_AgentNotPlannable_UpdateError(t *testing.T) {
	resultID := uuid.New()
	getter := &mockGetter{result: testResultRow(resultID, "unknown-agent", nil)}
	setter := &mockSetter{completedErr: fmt.Errorf("update failed")}

	ctrl := NewController(testRegistry(), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "mark result unsupported")
}

func TestProcess_AgentPlanError(t *testing.T) {
	resultID := uuid.New()
	agent := &mockAgent{agentType: "argo-cd", err: fmt.Errorf("connection refused")}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.completedCalls, 1)
	assert.Equal(t, resultID, setter.completedCalls[0].ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusErrored, setter.completedCalls[0].Status)
	assert.True(t, setter.completedCalls[0].Params.Message.Valid)
	assert.Equal(t, "connection refused", setter.completedCalls[0].Params.Message.String)
}

func TestProcess_AgentPlanError_UpdateError(t *testing.T) {
	resultID := uuid.New()
	agent := &mockAgent{agentType: "argo-cd", err: fmt.Errorf("connection refused")}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{completedErr: fmt.Errorf("update failed")}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "mark result errored")
	assert.Contains(t, err.Error(), "connection refused")
}

func TestProcess_Incomplete_SavesStateAndRequeues(t *testing.T) {
	resultID := uuid.New()
	agentState := json.RawMessage(`{"tmpAppName":"my-app-plan-abc"}`)
	agent := &mockAgent{
		agentType: "argo-cd",
		result:    &types.PlanResult{CompletedAt: nil, State: agentState},
	}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, requeueDelay, res.RequeueAfter)

	require.Len(t, setter.stateCalls, 1)
	assert.Equal(t, resultID, setter.stateCalls[0].ID)
	assert.Equal(t, []byte(agentState), setter.stateCalls[0].AgentState)
	assert.Empty(t, setter.completedCalls)
}

func TestProcess_Incomplete_SaveStateError(t *testing.T) {
	resultID := uuid.New()
	agent := &mockAgent{
		agentType: "argo-cd",
		result:    &types.PlanResult{CompletedAt: nil, State: json.RawMessage(`{}`)},
	}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{stateErr: fmt.Errorf("write failed")}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "save agent state")
}

func TestProcess_Completed_WithChanges(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	agent := &mockAgent{
		agentType: "argo-cd",
		result: &types.PlanResult{
			CompletedAt: &now,
			HasChanges:  true,
			ContentHash: "abc123",
			Current:     "old-manifest",
			Proposed:    "new-manifest",
			Message:     "2 resources changed",
		},
	}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	assert.Empty(t, setter.stateCalls)

	require.Len(t, setter.completedCalls, 1)
	call := setter.completedCalls[0]
	assert.Equal(t, resultID, call.ID)
	assert.Equal(t, db.DeploymentPlanTargetStatusCompleted, call.Status)

	assert.True(t, call.Params.HasChanges.Valid)
	assert.True(t, call.Params.HasChanges.Bool)
	assert.Equal(t, "abc123", call.Params.ContentHash.String)
	assert.True(t, call.Params.ContentHash.Valid)
	assert.Equal(t, "old-manifest", call.Params.Current.String)
	assert.Equal(t, "new-manifest", call.Params.Proposed.String)
	assert.True(t, call.Params.Message.Valid)
	assert.Equal(t, "2 resources changed", call.Params.Message.String)
}

func TestProcess_Completed_NoChanges(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	agent := &mockAgent{
		agentType: "test-runner",
		result: &types.PlanResult{
			CompletedAt: &now,
			HasChanges:  false,
			ContentHash: "test-runner",
		},
	}
	getter := &mockGetter{result: testResultRow(resultID, "test-runner", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	res, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)

	require.Len(t, setter.completedCalls, 1)
	call := setter.completedCalls[0]
	assert.Equal(t, db.DeploymentPlanTargetStatusCompleted, call.Status)
	assert.True(t, call.Params.HasChanges.Valid)
	assert.False(t, call.Params.HasChanges.Bool)
	assert.False(t, call.Params.Message.Valid, "empty message should not be stored")
}

func TestProcess_Completed_SaveError(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	agent := &mockAgent{
		agentType: "argo-cd",
		result:    &types.PlanResult{CompletedAt: &now, HasChanges: true},
	}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", nil)}
	setter := &mockSetter{completedErr: fmt.Errorf("write failed")}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "save completed result")
}

func TestProcess_PassesExistingAgentState(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	savedState := json.RawMessage(`{"tmpAppName":"my-app-plan-xyz"}`)
	agent := &mockAgent{
		agentType: "argo-cd",
		result:    &types.PlanResult{CompletedAt: &now},
	}
	getter := &mockGetter{result: testResultRow(resultID, "argo-cd", savedState)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.Equal(t, json.RawMessage(savedState), agent.calledState)
}

func TestProcess_ExtractsAgentTypeFromDispatchContext(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	agent := &mockAgent{
		agentType: "test-runner",
		result:    &types.PlanResult{CompletedAt: &now},
	}
	getter := &mockGetter{result: testResultRow(resultID, "test-runner", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	assert.NotNil(t, agent.calledDispatchCtx)
	assert.Equal(t, "test-runner", agent.calledDispatchCtx.JobAgent.Type)
}

func TestProcess_ContentHash_EmptyIsNotStored(t *testing.T) {
	resultID := uuid.New()
	now := time.Now()
	agent := &mockAgent{
		agentType: "test-runner",
		result:    &types.PlanResult{CompletedAt: &now, ContentHash: ""},
	}
	getter := &mockGetter{result: testResultRow(resultID, "test-runner", nil)}
	setter := &mockSetter{}

	ctrl := NewController(testRegistry(agent), getter, setter)
	_, err := ctrl.Process(context.Background(), testItem(resultID))

	require.NoError(t, err)
	require.Len(t, setter.completedCalls, 1)
	assert.False(t, setter.completedCalls[0].Params.ContentHash.Valid)
}
