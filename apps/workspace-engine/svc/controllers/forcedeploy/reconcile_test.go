package forcedeploy

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	rtExists    bool
	rtExistsErr error

	release    *oapi.Release
	releaseErr error

	activeJobs    []*oapi.Job
	activeJobsErr error

	deployment    *oapi.Deployment
	deploymentErr error

	environment    *oapi.Environment
	environmentErr error

	resource    *oapi.Resource
	resourceErr error

	workspaceAgents []oapi.JobAgent
}

func (m *mockGetter) ReleaseTargetExists(_ context.Context, _ *ReleaseTarget) (bool, error) {
	return m.rtExists, m.rtExistsErr
}

func (m *mockGetter) GetDesiredRelease(_ context.Context, _ *ReleaseTarget) (*oapi.Release, error) {
	return m.release, m.releaseErr
}

func (m *mockGetter) GetActiveJobsForReleaseTarget(
	_ context.Context,
	_ *oapi.ReleaseTarget,
) ([]*oapi.Job, error) {
	return m.activeJobs, m.activeJobsErr
}

func (m *mockGetter) GetDeployment(_ context.Context, _ uuid.UUID) (*oapi.Deployment, error) {
	return m.deployment, m.deploymentErr
}

func (m *mockGetter) GetEnvironment(_ context.Context, _ uuid.UUID) (*oapi.Environment, error) {
	return m.environment, m.environmentErr
}

func (m *mockGetter) GetResource(_ context.Context, _ uuid.UUID) (*oapi.Resource, error) {
	return m.resource, m.resourceErr
}

func (m *mockGetter) ListJobAgentsByWorkspaceID(
	_ context.Context,
	_ uuid.UUID,
) ([]oapi.JobAgent, error) {
	return m.workspaceAgents, nil
}

var _ Getter = (*mockGetter)(nil)

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type enqueueCall struct {
	WorkspaceID string
	JobID       string
}

type mockSetter struct {
	createdJobs  []*oapi.Job
	createJobErr error

	enqueueCalls []enqueueCall
	enqueueErr   error
}

func (m *mockSetter) CreateJob(_ context.Context, job *oapi.Job, _ *oapi.Release) error {
	if m.createJobErr != nil {
		return m.createJobErr
	}
	m.createdJobs = append(m.createdJobs, job)
	return nil
}

func (m *mockSetter) EnqueueJobDispatch(_ context.Context, workspaceID string, jobID string) error {
	if m.enqueueErr != nil {
		return m.enqueueErr
	}
	m.enqueueCalls = append(m.enqueueCalls, enqueueCall{WorkspaceID: workspaceID, JobID: jobID})
	return nil
}

var _ Setter = (*mockSetter)(nil)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func testRT() *ReleaseTarget {
	return &ReleaseTarget{
		WorkspaceID:   uuid.New(),
		DeploymentID:  uuid.New(),
		EnvironmentID: uuid.New(),
		ResourceID:    uuid.New(),
	}
}

func testRelease(rt *ReleaseTarget) *oapi.Release {
	return &oapi.Release{
		Id:        uuid.New(),
		CreatedAt: time.Now().Format(time.RFC3339),
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: rt.DeploymentID.String(),
			Tag:          "v1.0.0",
		},
	}
}

func testDeployment(rt *ReleaseTarget) *oapi.Deployment {
	return &oapi.Deployment{
		Id:               rt.DeploymentID.String(),
		Name:             "test-deployment",
		Slug:             "test-deployment",
		Metadata:         map[string]string{},
		JobAgentConfig:   oapi.JobAgentConfig{},
		JobAgentSelector: "true",
	}
}

func testAgent() oapi.JobAgent {
	return oapi.JobAgent{
		Id:     uuid.New().String(),
		Name:   "test-agent",
		Type:   "test",
		Config: oapi.JobAgentConfig{},
	}
}

func defaultMocks(rt *ReleaseTarget, release *oapi.Release) (*mockGetter, *mockSetter) {
	agent := testAgent()
	getter := &mockGetter{
		rtExists:        true,
		release:         release,
		activeJobs:      []*oapi.Job{},
		deployment:      testDeployment(rt),
		workspaceAgents: []oapi.JobAgent{agent},
		environment: &oapi.Environment{
			Id:       rt.EnvironmentID.String(),
			Name:     "test-env",
			Metadata: map[string]string{},
		},
		resource: &oapi.Resource{
			Id:         rt.ResourceID.String(),
			Name:       "test-resource",
			Kind:       "TestKind",
			Identifier: "test-resource-id",
			Metadata:   map[string]string{},
			Config:     map[string]any{},
		},
	}
	setter := &mockSetter{}
	return getter, setter
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestReconcile_HappyPath_CreatesJobAndEnqueuesDispatch(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := defaultMocks(rt, release)

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)

	require.NoError(t, err)
	assert.Zero(t, result.RequeueAfter)
	require.Len(t, setter.createdJobs, 1)
	assert.Equal(t, release.Id.String(), setter.createdJobs[0].ReleaseId)
	assert.Equal(t, oapi.JobStatusPending, setter.createdJobs[0].Status)
	require.Len(t, setter.enqueueCalls, 1)
	assert.Equal(t, rt.WorkspaceID.String(), setter.enqueueCalls[0].WorkspaceID)
	assert.Equal(t, setter.createdJobs[0].Id, setter.enqueueCalls[0].JobID)
}

func TestReconcile_HappyPath_WithCompletedJob(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := defaultMocks(rt, release)

	// A completed job already exists — should NOT block the redeploy.
	// activeJobs only returns processing-state jobs, so completed jobs
	// are not included.
	getter.activeJobs = []*oapi.Job{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)

	require.NoError(t, err)
	assert.Zero(t, result.RequeueAfter)
	require.Len(t, setter.createdJobs, 1)
}

func TestReconcile_NoDesiredRelease_Noop(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{
		rtExists: true,
		release:  nil,
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)

	require.NoError(t, err)
	assert.Zero(t, result.RequeueAfter)
	assert.Empty(t, setter.createdJobs)
	assert.Empty(t, setter.enqueueCalls)
}

func TestReconcile_ActiveJobExists_Requeues(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := defaultMocks(rt, release)

	getter.activeJobs = []*oapi.Job{
		{
			Id:        uuid.New().String(),
			ReleaseId: release.Id.String(),
			Status:    oapi.JobStatusInProgress,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Metadata:  map[string]string{},
		},
	}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)

	require.NoError(t, err)
	assert.Equal(t, requeueDelay, result.RequeueAfter)
	assert.Empty(t, setter.createdJobs)
	assert.Empty(t, setter.enqueueCalls)
}

func TestReconcile_ActivePendingJob_Requeues(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := defaultMocks(rt, release)

	getter.activeJobs = []*oapi.Job{
		{
			Id:        uuid.New().String(),
			ReleaseId: release.Id.String(),
			Status:    oapi.JobStatusPending,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Metadata:  map[string]string{},
		},
	}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)

	require.NoError(t, err)
	assert.Equal(t, requeueDelay, result.RequeueAfter)
	assert.Empty(t, setter.createdJobs)
}

func TestProcess_ActiveJob_ReturnsRequeueResult(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := defaultMocks(rt, release)

	getter.activeJobs = []*oapi.Job{
		{
			Id:        uuid.New().String(),
			ReleaseId: release.Id.String(),
			Status:    oapi.JobStatusInProgress,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Metadata:  map[string]string{},
		},
	}

	ctrl := NewController(getter, setter)
	item := reconcile.Item{
		ID:          1,
		WorkspaceID: rt.WorkspaceID.String(),
		Kind:        "force-deploy",
		ScopeType:   "release-target",
		ScopeID:     rt.DeploymentID.String() + ":" + rt.EnvironmentID.String() + ":" + rt.ResourceID.String(),
	}

	result, err := ctrl.Process(context.Background(), item)

	require.NoError(t, err)
	assert.Equal(t, requeueDelay, result.RequeueAfter)
	assert.Empty(t, setter.createdJobs)
}
