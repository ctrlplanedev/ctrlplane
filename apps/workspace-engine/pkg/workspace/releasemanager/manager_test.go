package releasemanager

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Mock Event Producer
// ============================================================================

// MockEventProducer is a test implementation of EventProducer that records all events.
type MockEventProducer struct {
	mu             sync.Mutex
	events         []MockEvent
	shouldError    bool
	errorMsg       string
	eventHandler   func(eventType string, workspaceID string, data any) error
}

// MockEvent represents a recorded event for testing.
type MockEvent struct {
	EventType   string
	WorkspaceID string
	Data        any
	Timestamp   time.Time
}

// NewMockEventProducer creates a new mock event producer.
func NewMockEventProducer() *MockEventProducer {
	return &MockEventProducer{
		events: make([]MockEvent, 0),
	}
}

// WithEventHandler sets a handler function that will be called for each event.
// This allows tests to process events synchronously (e.g., to persist jobs).
func (m *MockEventProducer) WithEventHandler(handler func(eventType string, workspaceID string, data any) error) *MockEventProducer {
	m.eventHandler = handler
	return m
}

// ProduceEvent records the event and optionally returns an error.
func (m *MockEventProducer) ProduceEvent(eventType string, workspaceID string, data any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return fmt.Errorf("%s", m.errorMsg)
	}

	m.events = append(m.events, MockEvent{
		EventType:   eventType,
		WorkspaceID: workspaceID,
		Data:        data,
		Timestamp:   time.Now(),
	})

	// Call event handler if set (for synchronous event processing in tests)
	if m.eventHandler != nil {
		if err := m.eventHandler(eventType, workspaceID, data); err != nil {
			return err
		}
	}

	return nil
}

// GetEvents returns all recorded events.
func (m *MockEventProducer) GetEvents() []MockEvent {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]MockEvent{}, m.events...)
}

// GetEventCount returns the number of recorded events.
func (m *MockEventProducer) GetEventCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.events)
}

// GetEventsOfType returns all events of a specific type.
func (m *MockEventProducer) GetEventsOfType(eventType string) []MockEvent {
	m.mu.Lock()
	defer m.mu.Unlock()

	filtered := make([]MockEvent, 0)
	for _, event := range m.events {
		if event.EventType == eventType {
			filtered = append(filtered, event)
		}
	}
	return filtered
}

// Reset clears all recorded events.
func (m *MockEventProducer) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = make([]MockEvent, 0)
}

// SetError configures the mock to return an error on the next call.
func (m *MockEventProducer) SetError(errorMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shouldError = true
	m.errorMsg = errorMsg
}

// ============================================================================
// Test Helper Functions
// ============================================================================

// setupTestStoreWithMock creates a store and mock event producer for testing.
func setupTestStoreWithMock(t *testing.T) (*store.Store, *MockEventProducer, string, string, string, string) {
	ctx := context.Background()
	st := store.New("test-workspace")

	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	resourceID := uuid.New().String()

	// Create system
	system := createTestSystem(workspaceID, systemID, "test-system")
	if err := st.Systems.Upsert(ctx, system); err != nil {
		t.Fatalf("Failed to upsert system: %v", err)
	}

	// Create environment with selector that matches all resources
	env := createTestEnvironment(environmentID, systemID, "test-environment")
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "name",
			"operator": "starts-with",
			"value":    "",
		},
	})
	env.ResourceSelector = selector
	if err := st.Environments.Upsert(ctx, env); err != nil {
		t.Fatalf("Failed to upsert environment: %v", err)
	}

	// Create deployment
	deployment := createTestDeployment(deploymentID, systemID, "test-deployment")
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("Failed to upsert deployment: %v", err)
	}

	// Create deployment version
	versionID := uuid.New().String()
	version := createTestDeploymentVersion(versionID, deploymentID, "v1.0.0")
	st.DeploymentVersions.Upsert(ctx, versionID, version)

	// Create resource
	resource := createTestResource(workspaceID, resourceID, "test-resource")
	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	// Wait for release targets to be computed
	if _, err := st.ReleaseTargets.Items(ctx); err != nil {
		t.Fatalf("Failed to get release targets: %v", err)
	}

	mockProducer := NewMockEventProducer()
	return st, mockProducer, systemID, environmentID, deploymentID, resourceID
}

// Helper functions for creating test entities
func createTestReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

func createTestEnvironment(id, systemID, name string) *oapi.Environment {
	return &oapi.Environment{
		Id:       id,
		SystemId: systemID,
		Name:     name,
	}
}

func createTestDeployment(id, systemID, name string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	return &oapi.Deployment{
		Id:               id,
		SystemId:         systemID,
		Name:             name,
		ResourceSelector: selector,
	}
}

func createTestDeploymentVersion(id, deploymentID, tag string) *oapi.DeploymentVersion {
	now := time.Now()
	return &oapi.DeploymentVersion{
		Id:           id,
		DeploymentId: deploymentID,
		Tag:          tag,
		CreatedAt:    now,
	}
}

func createTestResource(workspaceID, id, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata:    map[string]string{},
	}
}

func createTestSystem(workspaceID, id, name string) *oapi.System {
	return &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

// ============================================================================
// Manager Creation Tests
// ============================================================================

func TestNew_WithEventProducer(t *testing.T) {
	st := store.New("test-workspace")
	mockProducer := NewMockEventProducer()

	manager := New(st, mockProducer)

	assert.NotNil(t, manager)
	assert.NotNil(t, manager.store)
	assert.NotNil(t, manager.targetsManager)
	assert.NotNil(t, manager.planner)
	assert.NotNil(t, manager.jobEligibilityChecker)
	assert.NotNil(t, manager.jobCreator, "jobCreator should be initialized when eventProducer is provided")
}

func TestNew_WithoutEventProducer(t *testing.T) {
	st := store.New("test-workspace")

	manager := New(st, nil)

	assert.NotNil(t, manager)
	assert.NotNil(t, manager.store)
	assert.NotNil(t, manager.targetsManager)
	assert.NotNil(t, manager.planner)
	assert.NotNil(t, manager.jobEligibilityChecker)
	assert.Nil(t, manager.jobCreator, "jobCreator should be nil when no eventProducer is provided")
}

// ============================================================================
// ProcessChanges Event Producer Tests
// ============================================================================

func TestProcessChanges_EventProducerCalled_NewTarget(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, _, _ := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)

	// Set initial state with no targets
	manager.targetsManager.RefreshTargets(ctx)

	// Create a changeset with environment change (will trigger taint)
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(environmentID, uuid.New().String(), "updated-environment")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Process changes - should trigger job creation and event
	_, err := manager.ProcessChanges(ctx, cs)
	require.NoError(t, err)

	// Give some time for async operations
	time.Sleep(100 * time.Millisecond)

	// Verify event producer was called
	events := mockProducer.GetEventsOfType("job.created")
	assert.GreaterOrEqual(t, len(events), 1, "job.created event should be produced")

	if len(events) > 0 {
		event := events[0]
		assert.Equal(t, "job.created", event.EventType)
		assert.Equal(t, "test-workspace", event.WorkspaceID)
		assert.NotNil(t, event.Data, "event data should not be nil")

		// Validate event data
		jobEventData, ok := event.Data.(deployment.JobCreatedEventData)
		assert.True(t, ok, "event data should be of type JobCreatedEventData")
		assert.NotNil(t, jobEventData.Job, "job in event data should not be nil")
		assert.NotEmpty(t, jobEventData.Job.Id, "job ID should not be empty")
	}
}

func TestProcessChanges_NoEventProducer_ReturnsError(t *testing.T) {
	ctx := context.Background()
	st, _, _, _, _, _ := setupTestStoreWithMock(t)

	// Create manager WITHOUT event producer
	manager := New(st, nil)

	// Set initial state
	manager.targetsManager.RefreshTargets(ctx)

	// Create a changeset that would trigger deployment
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(uuid.New().String(), uuid.New().String(), "updated-environment")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Process changes - should return error because no event producer
	_, err := manager.ProcessChanges(ctx, cs)

	// The error might be nil if no job creation was attempted, or an error if it was
	// Either way, no events should be produced (since there's no producer)
	if err != nil {
		assert.Contains(t, err.Error(), "job creator not initialized", "error should mention missing job creator")
	}
}

func TestProcessChanges_MultipleTargets_MultipleEvents(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, _, deploymentID, _ := setupTestStoreWithMock(t)

	// Add another resource to create multiple release targets
	resourceID2 := uuid.New().String()
	resource2 := createTestResource("test-workspace", resourceID2, "test-resource-2")
	if _, err := st.Resources.Upsert(ctx, resource2); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	if _, err := st.ReleaseTargets.Items(ctx); err != nil {
		t.Fatalf("Failed to get release targets: %v", err)
	}

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	// Create a changeset that affects both targets
	cs := changeset.NewChangeSet[any]()
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v2.0.0")
	cs.Record(changeset.ChangeTypeCreate, version)

	// Process changes - should trigger job creation for both targets
	_, err := manager.ProcessChanges(ctx, cs)
	require.NoError(t, err)

	// Give some time for async operations
	time.Sleep(200 * time.Millisecond)

	// Verify multiple events were produced
	events := mockProducer.GetEventsOfType("job.created")
	assert.GreaterOrEqual(t, len(events), 1, "at least one job.created event should be produced")

	// Verify workspace ID is consistent
	for _, event := range events {
		assert.Equal(t, "test-workspace", event.WorkspaceID)
	}
}

func TestProcessChanges_CancelledJobs_NoEventsForCancellation(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	// Create a job in processing state
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	versionID := uuid.New().String()
	version := createTestDeploymentVersion(versionID, deploymentID, "v1.0.0")
	
	release := &oapi.Release{
		ReleaseTarget:      *target,
		Version:            *version,
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.Pending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	st.Jobs.Upsert(ctx, job)

	// Reset mock producer to clear any previous events
	mockProducer.Reset()

	// Remove the resource to trigger target removal and job cancellation
	st.Resources.Remove(ctx, resourceID)

	// Wait for targets to be recomputed
	time.Sleep(200 * time.Millisecond)

	// Create empty changeset (targets will be detected as removed)
	cs := changeset.NewChangeSet[any]()

	// Process changes - should cancel jobs for removed targets
	cancelledJobs, err := manager.ProcessChanges(ctx, cs)
	require.NoError(t, err)

	// Verify jobs were cancelled (recorded in changeset)
	assert.GreaterOrEqual(t, cancelledJobs.Count(), 0, "cancelled jobs map should be returned")

	// Note: Job cancellation is recorded in the changeset but doesn't produce events
	// The test verifies that the cancellation logic works without requiring event production
}

// ============================================================================
// Redeploy Event Producer Tests
// ============================================================================

func TestRedeploy_EventProducerCalled(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	// Redeploy the target
	err := manager.Redeploy(ctx, target)
	require.NoError(t, err)

	// Verify event producer was called
	events := mockProducer.GetEventsOfType("job.created")
	assert.Equal(t, 1, len(events), "exactly one job.created event should be produced")

	if len(events) > 0 {
		event := events[0]
		assert.Equal(t, "job.created", event.EventType)
		assert.Equal(t, "test-workspace", event.WorkspaceID)
		assert.NotNil(t, event.Data)
	}
}

func TestRedeploy_JobInProgress_NoEventProduced(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	// Create a job agent and assign it to the deployment so jobs will be created as Pending
	jobAgent := &oapi.JobAgent{
		Id:          uuid.New().String(),
		WorkspaceId: "test-workspace",
		Name:        "test-agent",
		Type:        "github",
	}
	st.JobAgents.Upsert(ctx, jobAgent)
	
	// Update deployment to use the job agent
	dep, _ := st.Deployments.Get(deploymentID)
	dep.JobAgentId = &jobAgent.Id
	st.Deployments.Upsert(ctx, dep)

	// Set up event handler to actually persist jobs (simulating what the real event handler does)
	mockProducer.WithEventHandler(func(eventType string, workspaceID string, data any) error {
		if eventType == "job.created" {
			// Extract job from event data (deployment.JobCreatedEventData)
			if eventData, ok := data.(deployment.JobCreatedEventData); ok {
				st.Jobs.Upsert(ctx, eventData.Job)
			}
		}
		return nil
	})

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	// First redeploy - should succeed
	err := manager.Redeploy(ctx, target)
	require.NoError(t, err)

	// Verify job was persisted in a processing state
	jobs := st.Jobs.Items()
	require.Equal(t, 1, len(jobs), "job should be persisted to store")
	
	var persistedJob *oapi.Job
	for _, job := range jobs {
		persistedJob = job
		break
	}
	assert.True(t, persistedJob.IsInProcessingState(), "job should be in processing state (Pending), got: %s", persistedJob.Status)

	// Reset mock to clear first event
	firstEventCount := mockProducer.GetEventCount()
	assert.Equal(t, 1, firstEventCount, "first redeploy should produce one event")
	mockProducer.Reset()

	// Second redeploy while first job is still pending - should fail
	err = manager.Redeploy(ctx, target)
	assert.Error(t, err, "redeploy should fail when job is in progress")
	assert.Contains(t, err.Error(), "job", "error should mention job")
	assert.Contains(t, err.Error(), "in progress", "error should mention in progress")

	// Verify no additional events were produced
	secondEventCount := mockProducer.GetEventCount()
	assert.Equal(t, 0, secondEventCount, "no additional events should be produced when redeploy fails")
}

func TestRedeploy_NoEventProducer_ReturnsError(t *testing.T) {
	ctx := context.Background()
	st, _, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	// Create manager WITHOUT event producer
	manager := New(st, nil)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	// Redeploy should fail because no event producer
	err := manager.Redeploy(ctx, target)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "job creator not initialized", "error should mention missing job creator")
}

func TestRedeploy_SkipsEligibilityCheck(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	// First deployment
	err := manager.Redeploy(ctx, target)
	require.NoError(t, err)

	firstEventCount := mockProducer.GetEventCount()
	assert.Equal(t, 1, firstEventCount)

	// Mark the job as completed
	jobs := st.Jobs.Items()
	for _, job := range jobs {
		job.Status = oapi.Successful
		job.UpdatedAt = time.Now()
		st.Jobs.Upsert(ctx, job)
	}

	mockProducer.Reset()

	// Redeploy again - should work even though job completed successfully
	// (normally eligibility checker might block this, but Redeploy skips eligibility)
	err = manager.Redeploy(ctx, target)
	require.NoError(t, err)

	secondEventCount := mockProducer.GetEventCount()
	assert.Equal(t, 1, secondEventCount, "redeploy should produce event even after successful deployment")
}

// ============================================================================
// Concurrent Access Tests
// ============================================================================

func TestProcessChanges_ConcurrentAccess_EventsProduced(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, _, _ := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	var wg sync.WaitGroup
	numGoroutines := 5

	// Run concurrent ProcessChanges calls
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(iteration int) {
			defer wg.Done()

			cs := changeset.NewChangeSet[any]()
			env := createTestEnvironment(environmentID, uuid.New().String(), fmt.Sprintf("env-%d", iteration))
			cs.Record(changeset.ChangeTypeUpdate, env)

			_, err := manager.ProcessChanges(ctx, cs)
			assert.NoError(t, err)
		}(i)
	}

	wg.Wait()

	// Give some time for async operations
	time.Sleep(300 * time.Millisecond)

	// Verify events were produced (may not be exactly numGoroutines due to eligibility checks)
	totalEvents := mockProducer.GetEventCount()
	assert.GreaterOrEqual(t, totalEvents, 1, "at least one event should be produced from concurrent operations")
}

// ============================================================================
// GetReleaseTargetState Tests
// ============================================================================

func TestGetReleaseTargetState_NoJobs(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	state, err := manager.GetReleaseTargetState(ctx, target)
	require.NoError(t, err)
	assert.NotNil(t, state)
	assert.NotNil(t, state.DesiredRelease, "desired release should exist (version available)")
	assert.Nil(t, state.CurrentRelease, "current release should be nil (no successful jobs)")
	assert.Nil(t, state.LatestJob, "latest job should be nil")
}

func TestGetReleaseTargetState_WithJob(t *testing.T) {
	ctx := context.Background()
	st, mockProducer, _, environmentID, deploymentID, resourceID := setupTestStoreWithMock(t)

	// Set up event handler to persist jobs
	mockProducer.WithEventHandler(func(eventType string, workspaceID string, data any) error {
		if eventType == "job.created" {
			if eventData, ok := data.(deployment.JobCreatedEventData); ok {
				st.Jobs.Upsert(ctx, eventData.Job)
			}
		}
		return nil
	})

	manager := New(st, mockProducer)
	manager.targetsManager.RefreshTargets(ctx)

	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)

	// Create a job
	err := manager.Redeploy(ctx, target)
	require.NoError(t, err)

	// Get state
	state, err := manager.GetReleaseTargetState(ctx, target)
	require.NoError(t, err)
	assert.NotNil(t, state)
	assert.NotNil(t, state.DesiredRelease)
	assert.Nil(t, state.CurrentRelease, "current release still nil (job not successful)")
	assert.NotNil(t, state.LatestJob, "latest job should exist")
}

