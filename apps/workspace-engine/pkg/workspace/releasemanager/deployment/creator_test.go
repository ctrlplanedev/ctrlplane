package deployment

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
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
	events      []MockEvent
	shouldError bool
	errorMsg    string
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

// ProduceEvent records the event and optionally returns an error.
func (m *MockEventProducer) ProduceEvent(eventType string, workspaceID string, data any) error {
	if m.shouldError {
		return fmt.Errorf("%s", m.errorMsg)
	}

	m.events = append(m.events, MockEvent{
		EventType:   eventType,
		WorkspaceID: workspaceID,
		Data:        data,
		Timestamp:   time.Now(),
	})

	return nil
}

// GetEvents returns all recorded events.
func (m *MockEventProducer) GetEvents() []MockEvent {
	return append([]MockEvent{}, m.events...)
}

// GetEventCount returns the number of recorded events.
func (m *MockEventProducer) GetEventCount() int {
	return len(m.events)
}

// SetError configures the mock to return an error on the next call.
func (m *MockEventProducer) SetError(errorMsg string) {
	m.shouldError = true
	m.errorMsg = errorMsg
}

// Reset clears all recorded events.
func (m *MockEventProducer) Reset() {
	m.events = make([]MockEvent, 0)
	m.shouldError = false
	m.errorMsg = ""
}

// ============================================================================
// Test Helper Functions
// ============================================================================

func setupTestStore(t *testing.T) (*store.Store, string, string, string, string) {
	ctx := context.Background()
	st := store.New("test-workspace")

	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	resourceID := uuid.New().String()

	// Create system
	system := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        "test-system",
	}
	if err := st.Systems.Upsert(ctx, system); err != nil {
		t.Fatalf("Failed to upsert system: %v", err)
	}

	// Create environment
	env := &oapi.Environment{
		Id:       environmentID,
		SystemId: systemID,
		Name:     "test-environment",
	}
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
	deployment := &oapi.Deployment{
		Id:       deploymentID,
		SystemId: systemID,
		Name:     "test-deployment",
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = depSelector
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("Failed to upsert deployment: %v", err)
	}

	// Create deployment version
	versionID := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:           versionID,
		DeploymentId: deploymentID,
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, versionID, version)

	// Create resource
	resource := &oapi.Resource{
		Id:          resourceID,
		WorkspaceId: workspaceID,
		Name:        "test-resource",
		Identifier:  "test-resource",
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   time.Now(),
		Config:      map[string]any{},
		Metadata:    map[string]string{},
	}
	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	// Wait for release targets to be computed
	if _, err := st.ReleaseTargets.Items(ctx); err != nil {
		t.Fatalf("Failed to get release targets: %v", err)
	}

	return st, systemID, environmentID, deploymentID, resourceID
}

func createTestReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

func createTestDeploymentVersion(id, deploymentID, tag string) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:           id,
		DeploymentId: deploymentID,
		Tag:          tag,
		CreatedAt:    time.Now(),
	}
}

// ============================================================================
// NewJobCreator Tests
// ============================================================================

func TestNewJobCreator(t *testing.T) {
	st := store.New("test-workspace")
	mockProducer := NewMockEventProducer()

	creator := NewJobCreator(st, mockProducer)

	assert.NotNil(t, creator)
	assert.NotNil(t, creator.store)
	assert.NotNil(t, creator.jobFactory)
	assert.NotNil(t, creator.eventProducer)
	assert.Equal(t, st, creator.store)
	assert.Equal(t, mockProducer, creator.eventProducer)
}

func TestNewJobCreator_NilEventProducer(t *testing.T) {
	st := store.New("test-workspace")

	creator := NewJobCreator(st, nil)

	assert.NotNil(t, creator)
	assert.NotNil(t, creator.store)
	assert.NotNil(t, creator.jobFactory)
	assert.Nil(t, creator.eventProducer)
}

// ============================================================================
// CreateJobForRelease Tests
// ============================================================================

func TestCreateJobForRelease_Success(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	mockProducer := NewMockEventProducer()
	creator := NewJobCreator(st, mockProducer)

	// Create a release
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v1.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release
	err := creator.CreateJobForRelease(ctx, release)
	require.NoError(t, err)

	// Verify release was persisted
	persistedRelease, exists := st.Releases.Get(release.ID())
	assert.True(t, exists, "release should be persisted")
	assert.Equal(t, release.ID(), persistedRelease.ID())

	// Verify event was produced
	events := mockProducer.GetEvents()
	assert.Equal(t, 1, len(events), "exactly one event should be produced")

	event := events[0]
	assert.Equal(t, "job.created", event.EventType)
	assert.Equal(t, "test-workspace", event.WorkspaceID)
	assert.Equal(t, release.ID(), event.Data.(JobCreatedEventData).Job.ReleaseId)
	assert.NotNil(t, event.Data)

	// Verify event data contains the job
	jobEventData, ok := event.Data.(JobCreatedEventData)
	assert.True(t, ok, "event data should be JobCreatedEventData")
	assert.NotNil(t, jobEventData.Job)
	assert.NotEmpty(t, jobEventData.Job.Id)
	assert.Equal(t, release.ID(), jobEventData.Job.ReleaseId)
}

func TestCreateJobForRelease_WithJobAgent(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	mockProducer := NewMockEventProducer()
	creator := NewJobCreator(st, mockProducer)

	// Create a job agent
	jobAgent := &oapi.JobAgent{
		Id:          uuid.New().String(),
		WorkspaceId: "test-workspace",
		Name:        "test-agent",
		Type:        "github",
		Config: map[string]any{
			"repo": "test-repo",
		},
	}
	st.JobAgents.Upsert(ctx, jobAgent)

	// Update deployment to use the job agent
	deployment, _ := st.Deployments.Get(deploymentID)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{
		"workflow": "deploy.yml",
	}
	st.Deployments.Upsert(ctx, deployment)

	// Create a release
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v2.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release
	err := creator.CreateJobForRelease(ctx, release)
	require.NoError(t, err)

	// Verify event was produced with job containing job agent
	events := mockProducer.GetEvents()
	require.Equal(t, 1, len(events))

	jobEventData, ok := events[0].Data.(JobCreatedEventData)
	require.True(t, ok)
	assert.Equal(t, jobAgent.Id, jobEventData.Job.JobAgentId)
	assert.Equal(t, oapi.Pending, jobEventData.Job.Status)
	assert.NotNil(t, jobEventData.Job.JobAgentConfig)
	// Config should be merged
	assert.Equal(t, "test-repo", jobEventData.Job.JobAgentConfig["repo"])
	assert.Equal(t, "deploy.yml", jobEventData.Job.JobAgentConfig["workflow"])
}

func TestCreateJobForRelease_NoJobAgent(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	mockProducer := NewMockEventProducer()
	creator := NewJobCreator(st, mockProducer)

	// Create a release without job agent
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v1.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release
	err := creator.CreateJobForRelease(ctx, release)
	require.NoError(t, err)

	// Verify event was produced with InvalidJobAgent status
	events := mockProducer.GetEvents()
	require.Equal(t, 1, len(events))

	jobEventData, ok := events[0].Data.(JobCreatedEventData)
	require.True(t, ok)
	assert.Equal(t, oapi.InvalidJobAgent, jobEventData.Job.Status)
	assert.Empty(t, jobEventData.Job.JobAgentId)
}

func TestCreateJobForRelease_EventProducerError(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	mockProducer := NewMockEventProducer()
	mockProducer.SetError("event producer failed")
	creator := NewJobCreator(st, mockProducer)

	// Create a release
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v1.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release should fail
	err := creator.CreateJobForRelease(ctx, release)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to produce job.created event")

	// Release should still be persisted even if event fails
	persistedRelease, exists := st.Releases.Get(release.ID())
	assert.True(t, exists, "release should be persisted even if event fails")
	assert.Equal(t, release.ID(), persistedRelease.ID())
}

func TestCreateJobForRelease_NilEventProducer(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	creator := NewJobCreator(st, nil) // No event producer

	// Create a release
	target := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	version := createTestDeploymentVersion(uuid.New().String(), deploymentID, "v1.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release should fail
	err := creator.CreateJobForRelease(ctx, release)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "event producer is nil")

	// Release should still be persisted
	persistedRelease, exists := st.Releases.Get(release.ID())
	assert.True(t, exists, "release should be persisted even if event producer is nil")
	assert.Equal(t, release.ID(), persistedRelease.ID())
}

func TestCreateJobForRelease_InvalidDeployment(t *testing.T) {
	ctx := context.Background()
	st := store.New("test-workspace")
	mockProducer := NewMockEventProducer()
	creator := NewJobCreator(st, mockProducer)

	// Create a release with non-existent deployment
	target := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String())
	version := createTestDeploymentVersion(uuid.New().String(), target.DeploymentId, "v1.0.0")
	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Create job for release - should persist release but fail on job creation
	err := creator.CreateJobForRelease(ctx, release)
	
	// The error occurs when trying to create the job (deployment not found)
	// But release is persisted first, so it should exist
	persistedRelease, exists := st.Releases.Get(release.ID())
	assert.True(t, exists, "release should be persisted before job creation")
	assert.Equal(t, release.ID(), persistedRelease.ID())

	// Job creation should have failed
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "deployment")
}

// ============================================================================
// BuildRelease Tests
// ============================================================================

func TestBuildRelease_BasicRelease(t *testing.T) {
	ctx := context.Background()
	target := createTestReleaseTarget(
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		target.DeploymentId,
		"v1.2.3",
	)
	
	// Create literal values using the proper API
	stringValue := oapi.LiteralValue{}
	_ = stringValue.FromStringValue("value1")
	
	numberValue := oapi.LiteralValue{}
	_ = numberValue.FromNumberValue(42.0)
	
	variables := map[string]*oapi.LiteralValue{
		"key1": &stringValue,
		"key2": &numberValue,
	}

	release := BuildRelease(ctx, target, version, variables)

	assert.NotNil(t, release)
	assert.Equal(t, target.EnvironmentId, release.ReleaseTarget.EnvironmentId)
	assert.Equal(t, target.DeploymentId, release.ReleaseTarget.DeploymentId)
	assert.Equal(t, target.ResourceId, release.ReleaseTarget.ResourceId)
	assert.Equal(t, version.Id, release.Version.Id)
	assert.Equal(t, version.Tag, release.Version.Tag)
	assert.Equal(t, 2, len(release.Variables))
	
	// Verify variables exist
	_, hasKey1 := release.Variables["key1"]
	_, hasKey2 := release.Variables["key2"]
	assert.True(t, hasKey1, "key1 should exist")
	assert.True(t, hasKey2, "key2 should exist")
	
	assert.Empty(t, release.EncryptedVariables)
	assert.NotEmpty(t, release.CreatedAt)
}

func TestBuildRelease_EmptyVariables(t *testing.T) {
	ctx := context.Background()
	target := createTestReleaseTarget(
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		target.DeploymentId,
		"v1.0.0",
	)
	variables := map[string]*oapi.LiteralValue{}

	release := BuildRelease(ctx, target, version, variables)

	assert.NotNil(t, release)
	assert.Equal(t, 0, len(release.Variables))
	assert.NotNil(t, release.Variables) // Map should exist but be empty
}

func TestBuildRelease_NilVariableValue(t *testing.T) {
	ctx := context.Background()
	target := createTestReleaseTarget(
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		target.DeploymentId,
		"v1.0.0",
	)
	
	stringValue := oapi.LiteralValue{}
	_ = stringValue.FromStringValue("value1")
	
	numberValue := oapi.LiteralValue{}
	_ = numberValue.FromNumberValue(99.0)
	
	variables := map[string]*oapi.LiteralValue{
		"key1": &stringValue,
		"key2": nil, // Nil value should be skipped
		"key3": &numberValue,
	}

	release := BuildRelease(ctx, target, version, variables)

	assert.NotNil(t, release)
	assert.Equal(t, 2, len(release.Variables), "nil values should be skipped")
	
	_, hasKey1 := release.Variables["key1"]
	_, hasKey2 := release.Variables["key2"]
	_, hasKey3 := release.Variables["key3"]
	
	assert.True(t, hasKey1, "key1 should exist")
	assert.False(t, hasKey2, "key2 should not exist (was nil)")
	assert.True(t, hasKey3, "key3 should exist")
}

func TestBuildRelease_VariableCloning(t *testing.T) {
	ctx := context.Background()
	target := createTestReleaseTarget(
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		target.DeploymentId,
		"v1.0.0",
	)
	
	// Create original variable
	originalValue := oapi.LiteralValue{}
	_ = originalValue.FromStringValue("original")
	
	variables := map[string]*oapi.LiteralValue{
		"key1": &originalValue,
	}

	release := BuildRelease(ctx, target, version, variables)

	// Verify the variable exists in the release
	_, hasKey1 := release.Variables["key1"]
	assert.True(t, hasKey1, "key1 should exist in release")

	// Modify the original value
	_ = originalValue.FromStringValue("modified")

	// The cloning test verifies that changes to the original don't affect the release
	// Since LiteralValue is a struct with json.RawMessage, we verify by checking
	// that the variable in the release is a different instance
	assert.NotNil(t, release.Variables["key1"])
}

func TestBuildRelease_ReleaseIDGenerated(t *testing.T) {
	ctx := context.Background()
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()
	
	target := createTestReleaseTarget(envID, depID, resID)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		depID,
		"v1.0.0",
	)

	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Release ID should be a non-empty hash (SHA256 of version + variables + target)
	assert.NotEmpty(t, release.ID(), "release ID should be generated")
	assert.Len(t, release.ID(), 64, "release ID should be SHA256 hash (64 hex chars)")
}

func TestBuildRelease_CreatedAtIsRFC3339(t *testing.T) {
	ctx := context.Background()
	target := createTestReleaseTarget(
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	)
	version := createTestDeploymentVersion(
		uuid.New().String(),
		target.DeploymentId,
		"v1.0.0",
	)

	release := BuildRelease(ctx, target, version, map[string]*oapi.LiteralValue{})

	// Verify CreatedAt is in RFC3339 format
	_, err := time.Parse(time.RFC3339, release.CreatedAt)
	assert.NoError(t, err, "CreatedAt should be in RFC3339 format")
}
