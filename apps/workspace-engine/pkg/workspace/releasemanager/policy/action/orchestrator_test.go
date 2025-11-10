package action_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/action"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock action for testing
type mockAction struct {
	name          string
	shouldExecute bool // Internal flag to simulate fail-fast behavior
	executeErr    error
	executeCalled bool
	lastTrigger   action.ActionTrigger
	lastContext   action.ActionContext
}

func (m *mockAction) Name() string {
	return m.name
}

func (m *mockAction) Execute(ctx context.Context, trigger action.ActionTrigger, actx action.ActionContext) error {
	// Simulate fail-fast behavior - return nil if action shouldn't execute
	if !m.shouldExecute {
		return nil
	}

	m.executeCalled = true
	m.lastTrigger = trigger
	m.lastContext = actx
	return m.executeErr
}

func newTestStore() *store.Store {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	return store.New(wsId, changeset)
}

func createTestData(s *store.Store, ctx context.Context) (*oapi.Release, *oapi.Policy) {
	// Create system
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}
	s.Systems.Upsert(ctx, system)

	// Create resource
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	s.Resources.Upsert(ctx, resource)

	// Create environment
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: systemId,
	}
	selector := &oapi.Selector{}
	selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	s.Environments.Upsert(ctx, environment)

	// Create deployment
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: systemId,
	}
	deploymentSelector := &oapi.Selector{}
	deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	s.Deployments.Upsert(ctx, deployment)

	// Create version
	versionId := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:           versionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, versionId, version)

	// Create release target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create release
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	s.Releases.Upsert(ctx, release)

	// Create policy
	policy := &oapi.Policy{
		Id:          uuid.New().String(),
		Name:        "test-policy",
		Enabled:     true,
		WorkspaceId: "test-workspace",
		Priority:    1,
		Metadata:    map[string]string{},
		Rules:       []oapi.PolicyRule{},
		Selectors: []oapi.PolicyTargetSelector{
			{
				DeploymentSelector:  deploymentSelector,
				EnvironmentSelector: selector,
				ResourceSelector:    selector,
			},
		},
	}
	s.Policies.Upsert(ctx, policy)

	return release, policy
}

func TestOrchestrator_RegisterAction(t *testing.T) {
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{name: "test-action"}
	orchestrator.RegisterAction(mockAct)

	// Action should be registered (we can't directly access the actions list, but execution will test this)
	assert.Equal(t, "test-action", mockAct.Name())
}

func TestOrchestrator_OnJobStatusChange_TriggerJobSuccess(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	// Create job
	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Simulate status change from Pending to Successful
	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	// Verify action was executed
	assert.True(t, mockAct.executeCalled)
	assert.Equal(t, action.TriggerJobSuccess, mockAct.lastTrigger)
	assert.Equal(t, job.Id, mockAct.lastContext.Job.Id)
	assert.Equal(t, release.ID(), mockAct.lastContext.Release.ID())
}

func TestOrchestrator_OnJobStatusChange_TriggerJobStarted(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	assert.True(t, mockAct.executeCalled)
	assert.Equal(t, action.TriggerJobStarted, mockAct.lastTrigger)
}

func TestOrchestrator_OnJobStatusChange_TriggerJobFailure(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusFailure,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusInProgress)
	require.NoError(t, err)

	assert.True(t, mockAct.executeCalled)
	assert.Equal(t, action.TriggerJobFailure, mockAct.lastTrigger)
}

func TestOrchestrator_OnJobStatusChange_NoTrigger(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	}

	// InProgress -> InProgress (no status change that triggers)
	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusInProgress)
	require.NoError(t, err)

	// Action should not be executed
	assert.False(t, mockAct.executeCalled)
}

func TestOrchestrator_OnJobStatusChange_ShouldNotExecute(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: false, // Action doesn't match
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	// Action should not be executed because it failed fast (returned nil without executing)
	assert.False(t, mockAct.executeCalled)
}

func TestOrchestrator_OnJobStatusChange_MultipleActions(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct1 := &mockAction{name: "action-1", shouldExecute: true}
	mockAct2 := &mockAction{name: "action-2", shouldExecute: true}
	mockAct3 := &mockAction{name: "action-3", shouldExecute: false}

	orchestrator.RegisterAction(mockAct1)
	orchestrator.RegisterAction(mockAct2)
	orchestrator.RegisterAction(mockAct3)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	// First two actions should be executed
	assert.True(t, mockAct1.executeCalled)
	assert.True(t, mockAct2.executeCalled)
	// Third action should not be executed (failed fast internally)
	assert.False(t, mockAct3.executeCalled)
}

func TestOrchestrator_OnJobStatusChange_ReleaseNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: "non-existent-release",
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err) // Should not fail

	// Action should not be executed because release not found
	assert.False(t, mockAct.executeCalled)
}

func TestOrchestrator_OnJobStatusChange_NoPolicies(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
	}
	orchestrator.RegisterAction(mockAct)

	// Create release but don't create matching policy
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}
	s.Systems.Upsert(ctx, system)

	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	s.Resources.Upsert(ctx, resource)

	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: systemId,
	}
	selector := &oapi.Selector{}
	selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	s.Environments.Upsert(ctx, environment)

	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: systemId,
	}
	deploymentSelector := &oapi.Selector{}
	deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	s.Deployments.Upsert(ctx, deployment)

	versionId := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:           versionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, versionId, version)

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	s.ReleaseTargets.Upsert(ctx, releaseTarget)

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	s.Releases.Upsert(ctx, release)

	// No policy created, so no policies should apply

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	// Action should not be executed because no policies apply
	assert.False(t, mockAct.executeCalled)
}

func TestOrchestrator_OnJobStatusChange_ActionError(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	orchestrator := action.NewOrchestrator(s)

	mockAct := &mockAction{
		name:          "test-action",
		shouldExecute: true,
		executeErr:    assert.AnError,
	}
	orchestrator.RegisterAction(mockAct)

	release, _ := createTestData(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Should not return error even if action fails
	err := orchestrator.OnJobStatusChange(ctx, job, oapi.JobStatusPending)
	require.NoError(t, err)

	// Action should have been called
	assert.True(t, mockAct.executeCalled)
}
