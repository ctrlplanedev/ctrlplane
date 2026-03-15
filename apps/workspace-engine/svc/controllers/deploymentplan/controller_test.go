package deploymentplan

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockGetter struct {
	plan       db.DeploymentPlan
	planErr    error
	deployment *oapi.Deployment
	depErr     error
	targets    []ReleaseTarget
	targetsErr error

	environments map[uuid.UUID]*oapi.Environment
	envErr       error
	resources    map[uuid.UUID]*oapi.Resource
	resErr       error
	jobAgents    map[uuid.UUID]*oapi.JobAgent
	agentErr     error
}

func (m *mockGetter) GetDeploymentPlan(_ context.Context, _ uuid.UUID) (db.DeploymentPlan, error) {
	return m.plan, m.planErr
}

func (m *mockGetter) GetDeployment(_ context.Context, _ uuid.UUID) (*oapi.Deployment, error) {
	return m.deployment, m.depErr
}

func (m *mockGetter) GetReleaseTargets(_ context.Context, _ uuid.UUID) ([]ReleaseTarget, error) {
	return m.targets, m.targetsErr
}

func (m *mockGetter) GetEnvironment(_ context.Context, id uuid.UUID) (*oapi.Environment, error) {
	if m.envErr != nil {
		return nil, m.envErr
	}
	env, ok := m.environments[id]
	if !ok {
		return nil, fmt.Errorf("environment %s not found", id)
	}
	return env, nil
}

func (m *mockGetter) GetResource(_ context.Context, id uuid.UUID) (*oapi.Resource, error) {
	if m.resErr != nil {
		return nil, m.resErr
	}
	res, ok := m.resources[id]
	if !ok {
		return nil, fmt.Errorf("resource %s not found", id)
	}
	return res, nil
}

func (m *mockGetter) GetJobAgent(_ context.Context, id uuid.UUID) (*oapi.JobAgent, error) {
	if m.agentErr != nil {
		return nil, m.agentErr
	}
	agent, ok := m.jobAgents[id]
	if !ok {
		return nil, fmt.Errorf("job agent %s not found", id)
	}
	return agent, nil
}

type insertTargetCall struct {
	PlanID, EnvID, ResourceID uuid.UUID
}

type insertResultCall struct {
	TargetID        uuid.UUID
	DispatchContext []byte
}

type enqueueResultCall struct {
	WorkspaceID string
	ResultID    string
}

type mockSetter struct {
	completePlanCalls []uuid.UUID
	completePlanErr   error

	insertTargetCalls []insertTargetCall
	insertTargetIDs   []uuid.UUID
	insertTargetErr   error

	insertResultCalls []insertResultCall
	insertResultIDs   []uuid.UUID
	insertResultErr   error

	enqueueResultCalls []enqueueResultCall
	enqueueResultErr   error
}

func (m *mockSetter) CompletePlan(_ context.Context, planID uuid.UUID) error {
	m.completePlanCalls = append(m.completePlanCalls, planID)
	return m.completePlanErr
}

func (m *mockSetter) InsertTarget(_ context.Context, planID, envID, resourceID uuid.UUID) (uuid.UUID, error) {
	m.insertTargetCalls = append(m.insertTargetCalls, insertTargetCall{planID, envID, resourceID})
	if m.insertTargetErr != nil {
		return uuid.UUID{}, m.insertTargetErr
	}
	idx := len(m.insertTargetCalls) - 1
	if idx < len(m.insertTargetIDs) {
		return m.insertTargetIDs[idx], nil
	}
	return uuid.New(), nil
}

func (m *mockSetter) InsertResult(_ context.Context, targetID uuid.UUID, dispatchContext []byte) (uuid.UUID, error) {
	m.insertResultCalls = append(m.insertResultCalls, insertResultCall{targetID, dispatchContext})
	if m.insertResultErr != nil {
		return uuid.UUID{}, m.insertResultErr
	}
	idx := len(m.insertResultCalls) - 1
	if idx < len(m.insertResultIDs) {
		return m.insertResultIDs[idx], nil
	}
	return uuid.New(), nil
}

func (m *mockSetter) EnqueueResult(_ context.Context, workspaceID, resultID string) error {
	m.enqueueResultCalls = append(m.enqueueResultCalls, enqueueResultCall{workspaceID, resultID})
	return m.enqueueResultErr
}

type mockVarResolver struct {
	variables map[string]oapi.LiteralValue
	err       error
}

func (m *mockVarResolver) Resolve(_ context.Context, _ *variableresolver.Scope, _, _ string) (map[string]oapi.LiteralValue, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.variables == nil {
		return map[string]oapi.LiteralValue{}, nil
	}
	return m.variables, nil
}

// --- helpers ---

func testPlanID() uuid.UUID       { return uuid.MustParse("aaaaaaaa-0000-0000-0000-000000000001") }
func testWorkspaceID() uuid.UUID  { return uuid.MustParse("aaaaaaaa-0000-0000-0000-000000000002") }
func testDeploymentID() uuid.UUID { return uuid.MustParse("aaaaaaaa-0000-0000-0000-000000000003") }

func testPlan() db.DeploymentPlan {
	return db.DeploymentPlan{
		ID:                    testPlanID(),
		WorkspaceID:           testWorkspaceID(),
		DeploymentID:          testDeploymentID(),
		VersionTag:            "v1.0.0",
		VersionName:           "release-1",
		VersionConfig:         map[string]any{},
		VersionJobAgentConfig: map[string]any{"planKey": "planVal"},
		VersionMetadata:       map[string]string{},
		Metadata:              map[string]string{},
		CreatedAt:             pgtype.Timestamptz{Valid: true},
		ExpiresAt:             pgtype.Timestamptz{Valid: true},
	}
}

func testItem() reconcile.Item {
	return reconcile.Item{
		ID:          1,
		WorkspaceID: testWorkspaceID().String(),
		Kind:        "deployment-plan",
		ScopeType:   "deployment-plan",
		ScopeID:     testPlanID().String(),
	}
}

func makeAgents(agentIDs ...uuid.UUID) *[]oapi.DeploymentJobAgent {
	agents := make([]oapi.DeploymentJobAgent, len(agentIDs))
	for i, id := range agentIDs {
		agents[i] = oapi.DeploymentJobAgent{
			Ref:    id.String(),
			Config: oapi.JobAgentConfig{"agentRefKey": "agentRefVal"},
		}
	}
	return &agents
}

func testDeployment(agentIDs ...uuid.UUID) *oapi.Deployment {
	dep := &oapi.Deployment{
		Id:             testDeploymentID().String(),
		Name:           "my-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
		Metadata:       map[string]string{},
	}
	if len(agentIDs) > 0 {
		dep.JobAgents = makeAgents(agentIDs...)
	}
	return dep
}

func testEnv(id uuid.UUID, name string) *oapi.Environment {
	return &oapi.Environment{
		Id:          id.String(),
		Name:        name,
		Metadata:    map[string]string{},
		WorkspaceId: testWorkspaceID().String(),
	}
}

func testResource(id uuid.UUID, name string) *oapi.Resource {
	return &oapi.Resource{
		Id:          id.String(),
		Name:        name,
		Kind:        "server",
		Identifier:  name,
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		WorkspaceId: testWorkspaceID().String(),
	}
}

func testJobAgent(id uuid.UUID, agentType string) *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:          id.String(),
		Name:        agentType,
		Type:        agentType,
		Config:      oapi.JobAgentConfig{"baseKey": "baseVal"},
		WorkspaceId: testWorkspaceID().String(),
	}
}

// --- tests ---

func TestProcess_InvalidScopeID(t *testing.T) {
	ctrl := NewController(&mockGetter{}, &mockSetter{}, &mockVarResolver{})
	item := reconcile.Item{ScopeID: "not-a-uuid"}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse plan id")
}

func TestProcess_GetPlanError(t *testing.T) {
	getter := &mockGetter{planErr: fmt.Errorf("not found")}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get deployment plan")
}

func TestProcess_GetDeploymentError(t *testing.T) {
	getter := &mockGetter{plan: testPlan(), depErr: fmt.Errorf("not found")}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get deployment")
}

func TestProcess_NoAgents_CompletesPlan(t *testing.T) {
	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(),
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.completePlanCalls, 1)
	assert.Equal(t, testPlanID(), setter.completePlanCalls[0])
}

func TestProcess_EmptyAgents_CompletesPlan(t *testing.T) {
	dep := testDeployment()
	empty := []oapi.DeploymentJobAgent{}
	dep.JobAgents = &empty

	getter := &mockGetter{plan: testPlan(), deployment: dep}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.completePlanCalls, 1)
}

func TestProcess_NoTargets_CompletesPlan(t *testing.T) {
	agentID := uuid.New()
	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(agentID),
		targets:    []ReleaseTarget{},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.completePlanCalls, 1)
}

func TestProcess_GetTargetsError(t *testing.T) {
	agentID := uuid.New()
	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(agentID),
		targetsErr: fmt.Errorf("db error"),
	}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get release targets")
}

func TestProcess_TargetAlreadyExists_Skipped(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(agentID),
		targets:    []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
	}
	setter := &mockSetter{insertTargetErr: ErrTargetExists}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)
	require.Len(t, setter.insertTargetCalls, 1)
	assert.Empty(t, setter.insertResultCalls)
}

func TestProcess_InsertTargetError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(agentID),
		targets:    []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
	}
	setter := &mockSetter{insertTargetErr: fmt.Errorf("fk violation")}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "insert plan target")
}

func TestProcess_GetEnvironmentError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{},
	}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get environment")
}

func TestProcess_GetResourceError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{},
	}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get resource")
}

func TestProcess_ResolveVariablesError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
	}
	varResolver := &mockVarResolver{err: fmt.Errorf("resolver error")}
	ctrl := NewController(getter, &mockSetter{}, varResolver)

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "resolve variables")
}

func TestProcess_GetJobAgentError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
		jobAgents:    map[uuid.UUID]*oapi.JobAgent{},
	}
	ctrl := NewController(getter, &mockSetter{}, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get job agent")
}

func TestProcess_SingleTarget_SingleAgent(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()
	targetID := uuid.New()
	resultID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
		jobAgents:    map[uuid.UUID]*oapi.JobAgent{agentID: testJobAgent(agentID, "argo-cd")},
	}
	setter := &mockSetter{
		insertTargetIDs: []uuid.UUID{targetID},
		insertResultIDs: []uuid.UUID{resultID},
	}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)

	require.Len(t, setter.insertTargetCalls, 1)
	assert.Equal(t, testPlanID(), setter.insertTargetCalls[0].PlanID)
	assert.Equal(t, envID, setter.insertTargetCalls[0].EnvID)
	assert.Equal(t, resID, setter.insertTargetCalls[0].ResourceID)

	require.Len(t, setter.insertResultCalls, 1)
	assert.Equal(t, targetID, setter.insertResultCalls[0].TargetID)

	require.Len(t, setter.enqueueResultCalls, 1)
	assert.Equal(t, testWorkspaceID().String(), setter.enqueueResultCalls[0].WorkspaceID)
	assert.Equal(t, resultID.String(), setter.enqueueResultCalls[0].ResultID)

	assert.Empty(t, setter.completePlanCalls)
}

func TestProcess_SingleTarget_SingleAgent_DispatchContext(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
		jobAgents:    map[uuid.UUID]*oapi.JobAgent{agentID: testJobAgent(agentID, "argo-cd")},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)

	require.Len(t, setter.insertResultCalls, 1)

	var dc oapi.DispatchContext
	err = json.Unmarshal(setter.insertResultCalls[0].DispatchContext, &dc)
	require.NoError(t, err)

	assert.Equal(t, testDeploymentID().String(), dc.Deployment.Id)
	assert.Equal(t, envID.String(), dc.Environment.Id)
	assert.Equal(t, resID.String(), dc.Resource.Id)
	assert.Equal(t, "v1.0.0", dc.Version.Tag)
	assert.Equal(t, "argo-cd", dc.JobAgent.Type)

	assert.Equal(t, "baseVal", dc.JobAgentConfig["baseKey"])
	assert.Equal(t, "agentRefVal", dc.JobAgentConfig["agentRefKey"])
	assert.Equal(t, "planVal", dc.JobAgentConfig["planKey"])
}

func TestProcess_MultipleTargets_MultipleAgents(t *testing.T) {
	agent1 := uuid.New()
	agent2 := uuid.New()
	env1 := uuid.New()
	env2 := uuid.New()
	res1 := uuid.New()
	res2 := uuid.New()

	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(agent1, agent2),
		targets: []ReleaseTarget{
			{EnvironmentID: env1, ResourceID: res1},
			{EnvironmentID: env2, ResourceID: res2},
		},
		environments: map[uuid.UUID]*oapi.Environment{
			env1: testEnv(env1, "staging"),
			env2: testEnv(env2, "prod"),
		},
		resources: map[uuid.UUID]*oapi.Resource{
			res1: testResource(res1, "us-east-1"),
			res2: testResource(res2, "eu-west-1"),
		},
		jobAgents: map[uuid.UUID]*oapi.JobAgent{
			agent1: testJobAgent(agent1, "argo-cd"),
			agent2: testJobAgent(agent2, "test-runner"),
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	res, err := ctrl.Process(context.Background(), testItem())
	require.NoError(t, err)
	assert.Equal(t, reconcile.Result{}, res)

	assert.Len(t, setter.insertTargetCalls, 2)
	assert.Len(t, setter.insertResultCalls, 4)
	assert.Len(t, setter.enqueueResultCalls, 4)
}

func TestProcess_InsertResultError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
		jobAgents:    map[uuid.UUID]*oapi.JobAgent{agentID: testJobAgent(agentID, "argo-cd")},
	}
	setter := &mockSetter{insertResultErr: fmt.Errorf("db error")}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "insert plan target result")
}

func TestProcess_EnqueueResultError(t *testing.T) {
	agentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		plan:         testPlan(),
		deployment:   testDeployment(agentID),
		targets:      []ReleaseTarget{{EnvironmentID: envID, ResourceID: resID}},
		environments: map[uuid.UUID]*oapi.Environment{envID: testEnv(envID, "prod")},
		resources:    map[uuid.UUID]*oapi.Resource{resID: testResource(resID, "us-east-1")},
		jobAgents:    map[uuid.UUID]*oapi.JobAgent{agentID: testJobAgent(agentID, "argo-cd")},
	}
	setter := &mockSetter{enqueueResultErr: fmt.Errorf("queue error")}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "enqueue plan target result")
}

func TestProcess_CompletePlanError(t *testing.T) {
	getter := &mockGetter{
		plan:       testPlan(),
		deployment: testDeployment(),
	}
	setter := &mockSetter{completePlanErr: fmt.Errorf("db error")}
	ctrl := NewController(getter, setter, &mockVarResolver{})

	_, err := ctrl.Process(context.Background(), testItem())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "mark plan completed")
}
