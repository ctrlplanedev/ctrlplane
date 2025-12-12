package releasemanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/aws/smithy-go/ptr"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== Test Helper Functions =====

func setupTestOrchestrator(t *testing.T) (*DeploymentOrchestrator, *store.Store) {
	t.Helper()
	cs := statechange.NewChangeSet[any]()
	testStore := store.New("test-workspace", cs)
	testVerification := verification.NewManager(testStore)
	orchestrator := NewDeploymentOrchestrator(testStore, testVerification)
	return orchestrator, testStore
}

func createTestSystemForOrchestrator(id, name string) *oapi.System {
	return &oapi.System{
		Id:          id,
		Name:        name,
		Description: ptr.String("Test system"),
	}
}

func createTestEnvironmentForOrchestrator(id, systemID, name string) *oapi.Environment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	return &oapi.Environment{
		Id:               id,
		SystemId:         systemID,
		Name:             name,
		Description:      ptr.String("Test environment"),
		ResourceSelector: selector,
	}
}

func createTestDeploymentForOrchestrator(id, systemID, name string, jobAgentID *string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		SystemId:         systemID,
		ResourceSelector: selector,
		JobAgentId:       jobAgentID,
		JobAgentConfig:   map[string]any{},
	}
}

func createTestDeploymentVersionForOrchestrator(id, deploymentID, tag string, status oapi.DeploymentVersionStatus) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:           id,
		DeploymentId: deploymentID,
		Tag:          tag,
		Name:         "version-" + tag,
		Status:       status,
		Config:       map[string]any{},
		CreatedAt:    time.Now(),
	}
}

func createTestResourceForOrchestrator(id, name string) *oapi.Resource {
	return &oapi.Resource{
		Id:       id,
		Name:     name,
		Metadata: map[string]string{},
		Config:   map[string]any{},
	}
}

func createTestJobAgentForOrchestrator(id, workspaceID, name, agentType string) *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        agentType,
		Config:      map[string]any{},
	}
}

// setupFullTestScenarioForOrchestrator creates a complete test scenario with all necessary entities
func setupFullTestScenarioForOrchestrator(t *testing.T, testStore *store.Store) (
	system *oapi.System,
	environment *oapi.Environment,
	deployment *oapi.Deployment,
	version *oapi.DeploymentVersion,
	resource *oapi.Resource,
	jobAgent *oapi.JobAgent,
	releaseTarget *oapi.ReleaseTarget,
) {
	t.Helper()
	ctx := context.Background()

	workspaceID := "test-workspace"
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	versionID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

	// Create entities
	system = createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	environment = createTestEnvironmentForOrchestrator(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	jobAgent = createTestJobAgentForOrchestrator(jobAgentID, workspaceID, "test-agent", "kubernetes")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment = createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment", &jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	version = createTestDeploymentVersionForOrchestrator(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
	testStore.DeploymentVersions.Upsert(ctx, versionID, version)

	resource = createTestResourceForOrchestrator(resourceID, "test-resource")
	_, _ = testStore.Resources.Upsert(ctx, resource)

	releaseTarget = &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	_ = testStore.ReleaseTargets.Upsert(ctx, releaseTarget)

	return
}

// ===== DeploymentOrchestrator.Reconcile Tests =====

func TestDeploymentOrchestrator_Reconcile_Success(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup complete test scenario
	_, _, _, _, _, _, releaseTarget := setupFullTestScenarioForOrchestrator(t, testStore)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile the release target
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, release, "Should have a desired release")
	require.NotNil(t, job, "Should have created a job")

	assert.Equal(t, releaseTarget.DeploymentId, release.ReleaseTarget.DeploymentId)
	assert.Equal(t, releaseTarget.EnvironmentId, release.ReleaseTarget.EnvironmentId)
	assert.Equal(t, releaseTarget.ResourceId, release.ReleaseTarget.ResourceId)
	assert.Equal(t, "v1.0.0", release.Version.Tag)

	assert.Equal(t, release.ID(), job.ReleaseId)
	assert.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify release was persisted
	storedRelease, exists := testStore.Releases.Get(release.ID())
	require.True(t, exists)
	assert.Equal(t, release.ID(), storedRelease.ID())

	// Verify job was persisted
	storedJob, exists := testStore.Jobs.Get(job.Id)
	require.True(t, exists)
	assert.Equal(t, job.Id, storedJob.Id)
}

func TestDeploymentOrchestrator_Reconcile_NoVersionsAvailable(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup scenario WITHOUT any deployment version
	workspaceID := "test-workspace"
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

	system := createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	environment := createTestEnvironmentForOrchestrator(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	jobAgent := createTestJobAgentForOrchestrator(jobAgentID, workspaceID, "test-agent", "kubernetes")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment := createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment", &jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	// Note: No deployment version created

	resource := createTestResourceForOrchestrator(resourceID, "test-resource")
	_, _ = testStore.Resources.Upsert(ctx, resource)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	_ = testStore.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile the release target
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions - no release because no versions
	require.NoError(t, err)
	assert.Nil(t, release, "Should have no desired release when no versions available")
	assert.Nil(t, job, "Should have no job when no versions available")
}

func TestDeploymentOrchestrator_Reconcile_SkipEligibilityCheck(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup complete test scenario
	_, _, _, _, _, _, releaseTarget := setupFullTestScenarioForOrchestrator(t, testStore)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerManual)

	// Reconcile with skip eligibility check option
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder,
		WithSkipEligibilityCheck(true))

	// Assertions - should still create job
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
	assert.Equal(t, oapi.JobStatusPending, job.Status)
}

func TestDeploymentOrchestrator_Reconcile_JobAlreadyExists(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup complete test scenario
	_, _, deployment, version, _, _, releaseTarget := setupFullTestScenarioForOrchestrator(t, testStore)

	// Pre-create a release and job for this target
	existingRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:           version.Id,
			DeploymentId: deployment.Id,
			Tag:          version.Tag,
		},
		Variables: map[string]oapi.LiteralValue{},
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	_ = testStore.Releases.Upsert(ctx, existingRelease)

	existingJob := &oapi.Job{
		Id:         uuid.New().String(),
		ReleaseId:  existingRelease.ID(),
		JobAgentId: *deployment.JobAgentId,
		Status:     oapi.JobStatusPending,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	testStore.Jobs.Upsert(ctx, existingJob)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile the release target
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions - should return desired release but no new job (eligibility denied)
	require.NoError(t, err)
	require.NotNil(t, release, "Should still compute desired release")
	assert.Nil(t, job, "Should not create a new job when one already exists")
}

func TestDeploymentOrchestrator_Reconcile_InvalidJobAgent(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup scenario with deployment that has no job agent
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	versionID := uuid.New().String()
	resourceID := uuid.New().String()

	system := createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	environment := createTestEnvironmentForOrchestrator(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	// Deployment with NO job agent
	deployment := createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment", nil)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	version := createTestDeploymentVersionForOrchestrator(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
	testStore.DeploymentVersions.Upsert(ctx, versionID, version)

	resource := createTestResourceForOrchestrator(resourceID, "test-resource")
	_, _ = testStore.Resources.Upsert(ctx, resource)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	_ = testStore.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile the release target
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions - should create job but with InvalidJobAgent status
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
	assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
}

func TestDeploymentOrchestrator_Reconcile_MultipleVersionsSelectsLatest(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup scenario with multiple versions
	workspaceID := "test-workspace"
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

	system := createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	environment := createTestEnvironmentForOrchestrator(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	jobAgent := createTestJobAgentForOrchestrator(jobAgentID, workspaceID, "test-agent", "kubernetes")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment := createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment", &jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	// Create multiple versions with different creation times
	v1ID := uuid.New().String()
	v1 := &oapi.DeploymentVersion{
		Id:           v1ID,
		DeploymentId: deploymentID,
		Tag:          "v1.0.0",
		Name:         "version-v1.0.0",
		Status:       oapi.DeploymentVersionStatusReady,
		Config:       map[string]any{},
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	testStore.DeploymentVersions.Upsert(ctx, v1ID, v1)

	v2ID := uuid.New().String()
	v2 := &oapi.DeploymentVersion{
		Id:           v2ID,
		DeploymentId: deploymentID,
		Tag:          "v2.0.0",
		Name:         "version-v2.0.0",
		Status:       oapi.DeploymentVersionStatusReady,
		Config:       map[string]any{},
		CreatedAt:    time.Now().Add(-1 * time.Hour),
	}
	testStore.DeploymentVersions.Upsert(ctx, v2ID, v2)

	v3ID := uuid.New().String()
	v3 := &oapi.DeploymentVersion{
		Id:           v3ID,
		DeploymentId: deploymentID,
		Tag:          "v3.0.0",
		Name:         "version-v3.0.0",
		Status:       oapi.DeploymentVersionStatusReady,
		Config:       map[string]any{},
		CreatedAt:    time.Now(),
	}
	testStore.DeploymentVersions.Upsert(ctx, v3ID, v3)

	resource := createTestResourceForOrchestrator(resourceID, "test-resource")
	_, _ = testStore.Resources.Upsert(ctx, resource)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	_ = testStore.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile the release target
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions - should select the latest version (v3.0.0)
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
	assert.Equal(t, "v3.0.0", release.Version.Tag)
}

func TestDeploymentOrchestrator_Reconcile_WithNilRecorder(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup complete test scenario
	_, _, _, _, _, _, releaseTarget := setupFullTestScenarioForOrchestrator(t, testStore)

	// Reconcile with nil recorder - should not panic
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, nil)

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
}

func TestDeploymentOrchestrator_Reconcile_ReleaseTargetNotInStore(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup entities but don't add release target to store
	workspaceID := "test-workspace"
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	versionID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

	system := createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	environment := createTestEnvironmentForOrchestrator(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	jobAgent := createTestJobAgentForOrchestrator(jobAgentID, workspaceID, "test-agent", "kubernetes")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment := createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment", &jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	version := createTestDeploymentVersionForOrchestrator(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
	testStore.DeploymentVersions.Upsert(ctx, versionID, version)

	resource := createTestResourceForOrchestrator(resourceID, "test-resource")
	_, _ = testStore.Resources.Upsert(ctx, resource)

	// Create release target but don't add to store
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	// Note: NOT adding to store

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile should still work (planner doesn't require target in store)
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder)

	// Assertions - should still work
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
}

func TestDeploymentOrchestrator_Reconcile_WithResourceRelationships(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup complete test scenario
	_, _, _, _, resource, _, releaseTarget := setupFullTestScenarioForOrchestrator(t, testStore)

	// Create some resource relationships (empty for simplicity)
	relationships := map[string][]*oapi.EntityRelation{
		resource.Id: {},
	}

	// Create trace recorder
	recorder := trace.NewReconcileTarget("test-workspace", releaseTarget.Key(), trace.TriggerScheduled)

	// Reconcile with relationships option
	release, job, err := orchestrator.Reconcile(ctx, releaseTarget, recorder,
		WithResourceRelationships(relationships))

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, release)
	require.NotNil(t, job)
}

// ===== Planner Access Test =====

func TestDeploymentOrchestrator_Planner(t *testing.T) {
	orchestrator, _ := setupTestOrchestrator(t)

	// Should return non-nil planner
	planner := orchestrator.Planner()
	require.NotNil(t, planner)
}

// ===== Concurrent Reconciliation Test =====

func TestDeploymentOrchestrator_Reconcile_Concurrent(t *testing.T) {
	orchestrator, testStore := setupTestOrchestrator(t)
	ctx := context.Background()

	// Setup multiple release targets
	workspaceID := "test-workspace"
	systemID := uuid.New().String()
	jobAgentID := uuid.New().String()

	system := createTestSystemForOrchestrator(systemID, "test-system")
	_ = testStore.Systems.Upsert(ctx, system)

	jobAgent := createTestJobAgentForOrchestrator(jobAgentID, workspaceID, "test-agent", "kubernetes")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	// Create multiple targets
	numTargets := 5
	targets := make([]*oapi.ReleaseTarget, numTargets)

	for i := 0; i < numTargets; i++ {
		envID := uuid.New().String()
		deploymentID := uuid.New().String()
		resourceID := uuid.New().String()
		versionID := uuid.New().String()

		env := createTestEnvironmentForOrchestrator(envID, systemID, "test-env-"+string(rune('A'+i)))
		_ = testStore.Environments.Upsert(ctx, env)

		deployment := createTestDeploymentForOrchestrator(deploymentID, systemID, "test-deployment-"+string(rune('A'+i)), &jobAgentID)
		_ = testStore.Deployments.Upsert(ctx, deployment)

		version := createTestDeploymentVersionForOrchestrator(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
		testStore.DeploymentVersions.Upsert(ctx, versionID, version)

		resource := createTestResourceForOrchestrator(resourceID, "test-resource-"+string(rune('A'+i)))
		_, _ = testStore.Resources.Upsert(ctx, resource)

		targets[i] = &oapi.ReleaseTarget{
			DeploymentId:  deploymentID,
			EnvironmentId: envID,
			ResourceId:    resourceID,
		}
		_ = testStore.ReleaseTargets.Upsert(ctx, targets[i])
	}

	// Reconcile concurrently
	type result struct {
		release *oapi.Release
		job     *oapi.Job
		err     error
	}

	results := make(chan result, numTargets)

	for _, target := range targets {
		go func(t *oapi.ReleaseTarget) {
			recorder := trace.NewReconcileTarget("test-workspace", t.Key(), trace.TriggerScheduled)
			release, job, err := orchestrator.Reconcile(ctx, t, recorder)
			results <- result{release, job, err}
		}(target)
	}

	// Collect results
	for i := 0; i < numTargets; i++ {
		r := <-results
		require.NoError(t, r.err)
		require.NotNil(t, r.release)
		require.NotNil(t, r.job)
	}
}
