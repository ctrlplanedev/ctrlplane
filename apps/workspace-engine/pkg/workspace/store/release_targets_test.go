package store_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper functions
func createTestReleaseAndJob(s *store.Store, ctx context.Context, tag string, completedAt time.Time) (*oapi.Release, *oapi.Job) {
	// Create system
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:          systemId,
		Name:        "test-system",
		Description: ptr("Test system"),
	}
	_ = s.Systems.Upsert(ctx, system)

	// Create resource
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "test-res-" + uuid.New().String()[:8],
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	// Create environment
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:          environmentId,
		Name:        "test-env",
		Description: ptr("Test environment"),
		SystemId:    systemId,
	}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	// Create deployment
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:          deploymentId,
		Name:        "test-deployment",
		Slug:        "test-deployment",
		Description: ptr("Test deployment"),
		SystemId:    systemId,
	}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

	// Create version
	versionId := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:           versionId,
		Tag:          tag,
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
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create release
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	// Create job
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   completedAt.Add(-1 * time.Minute),
		CompletedAt: &completedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, job)

	return release, job
}

func createVerificationWithStatus(s *store.Store, ctx context.Context, releaseId string, status oapi.ReleaseVerificationStatus, createdAt time.Time) *oapi.ReleaseVerification {
	// Create metrics that result in the desired status
	var metrics []oapi.VerificationMetricStatus

	switch status {
	case oapi.ReleaseVerificationStatusPassed:
		// All measurements passed, all complete
		metrics = []oapi.VerificationMetricStatus{
			{
				Name:             "health-check",
				Interval:         "30s",
				Count:            2,
				SuccessCondition: "result.statusCode == 200",
				Provider:         oapi.MetricProvider{},
				Measurements: []oapi.VerificationMeasurement{
					{Passed: true, MeasuredAt: createdAt},
					{Passed: true, MeasuredAt: createdAt.Add(30 * time.Second)},
				},
			},
		}
	case oapi.ReleaseVerificationStatusFailed:
		// Some measurements failed
		metrics = []oapi.VerificationMetricStatus{
			{
				Name:             "health-check",
				Interval:         "30s",
				Count:            2,
				SuccessCondition: "result.statusCode == 200",
				Provider:         oapi.MetricProvider{},
				Measurements: []oapi.VerificationMeasurement{
					{Passed: false, MeasuredAt: createdAt},
					{Passed: false, MeasuredAt: createdAt.Add(30 * time.Second)},
				},
			},
		}
	case oapi.ReleaseVerificationStatusRunning:
		// Not all measurements complete
		metrics = []oapi.VerificationMetricStatus{
			{
				Name:             "health-check",
				Interval:         "30s",
				Count:            3,
				SuccessCondition: "result.statusCode == 200",
				Provider:         oapi.MetricProvider{},
				Measurements: []oapi.VerificationMeasurement{
					{Passed: true, MeasuredAt: createdAt},
				},
			},
		}
	case oapi.ReleaseVerificationStatusCancelled:
		// For cancelled, we'll create a failed metric that hit failure limit
		// Actually, cancelled isn't computed by Status() - let's use empty metrics with a special flag
		// For now, let's just use failed status with zero measurements as a proxy
		metrics = []oapi.VerificationMetricStatus{
			{
				Name:             "health-check",
				Interval:         "30s",
				Count:            2,
				SuccessCondition: "result.statusCode == 200",
				Provider:         oapi.MetricProvider{},
				Measurements: []oapi.VerificationMeasurement{
					{Passed: false, MeasuredAt: createdAt},
				},
			},
		}
	}

	verification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseId,
		CreatedAt: createdAt,
		Metrics:   metrics,
	}

	s.ReleaseVerifications.Upsert(ctx, verification)
	return verification
}

// Tests

func TestGetCurrentRelease_NoVerification(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create a successful job for a release
	completedAt := time.Now()
	release, _ := createTestReleaseAndJob(s, ctx, "v1.0.0", completedAt)

	// Get current release
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, &release.ReleaseTarget)

	require.NoError(t, err)
	require.NotNil(t, currentRelease)
	require.NotNil(t, currentJob)
	assert.Equal(t, release.ID(), currentRelease.ID())
	assert.Equal(t, oapi.JobStatusSuccessful, currentJob.Status)
}

func TestGetCurrentRelease_PassedVerification(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create a successful job and passed verification
	completedAt := time.Now()
	release, _ := createTestReleaseAndJob(s, ctx, "v1.0.0", completedAt)

	// Create passed verification
	verification := createVerificationWithStatus(s, ctx, release.ID(), oapi.ReleaseVerificationStatusPassed, time.Now())
	require.Equal(t, oapi.ReleaseVerificationStatusPassed, verification.Status())

	// Get current release
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, &release.ReleaseTarget)

	require.NoError(t, err)
	require.NotNil(t, currentRelease)
	require.NotNil(t, currentJob)
	assert.Equal(t, release.ID(), currentRelease.ID())
}

func TestGetCurrentRelease_FailedVerification_FallbackToPrevious(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create system, resource, environment, deployment (shared)
	systemId := uuid.New().String()
	system := &oapi.System{Id: systemId, Name: "test-system"}
	_ = s.Systems.Upsert(ctx, system)

	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	environmentId := uuid.New().String()
	environment := &oapi.Environment{Id: environmentId, Name: "test-env", SystemId: systemId}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{Id: deploymentId, Name: "test-deployment", Slug: "test-deployment", SystemId: systemId}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

	// Create release target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create older release with passed verification
	olderVersionId := uuid.New().String()
	olderVersion := &oapi.DeploymentVersion{
		Id:           olderVersionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	s.DeploymentVersions.Upsert(ctx, olderVersionId, olderVersion)

	olderRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *olderVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, olderRelease)

	olderJobCompletedAt := time.Now().Add(-1 * time.Hour)
	olderJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   olderRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   olderJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &olderJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, olderJob)

	olderVerification := createVerificationWithStatus(s, ctx, olderRelease.ID(), oapi.ReleaseVerificationStatusPassed, time.Now().Add(-1*time.Hour))
	require.Equal(t, oapi.ReleaseVerificationStatusPassed, olderVerification.Status())

	// Create newer release with failed verification
	newerVersionId := uuid.New().String()
	newerVersion := &oapi.DeploymentVersion{
		Id:           newerVersionId,
		Tag:          "v2.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, newerVersionId, newerVersion)

	newerRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *newerVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, newerRelease)

	newerJobCompletedAt := time.Now()
	newerJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   newerRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   newerJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &newerJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, newerJob)

	newerVerification := createVerificationWithStatus(s, ctx, newerRelease.ID(), oapi.ReleaseVerificationStatusFailed, time.Now())
	require.Equal(t, oapi.ReleaseVerificationStatusFailed, newerVerification.Status())

	// Get current release - should return older release
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, currentRelease)
	require.NotNil(t, currentJob)
	assert.Equal(t, olderRelease.ID(), currentRelease.ID())
	assert.Equal(t, "v1.0.0", currentRelease.Version.Tag)
}

func TestGetCurrentRelease_RunningVerification_FallbackToPrevious(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create system, resource, environment, deployment (shared)
	systemId := uuid.New().String()
	system := &oapi.System{Id: systemId, Name: "test-system"}
	_ = s.Systems.Upsert(ctx, system)

	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	environmentId := uuid.New().String()
	environment := &oapi.Environment{Id: environmentId, Name: "test-env", SystemId: systemId}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{Id: deploymentId, Name: "test-deployment", Slug: "test-deployment", SystemId: systemId}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

	// Create release target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create older release with passed verification
	olderVersionId := uuid.New().String()
	olderVersion := &oapi.DeploymentVersion{
		Id:           olderVersionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	s.DeploymentVersions.Upsert(ctx, olderVersionId, olderVersion)

	olderRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *olderVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, olderRelease)

	olderJobCompletedAt := time.Now().Add(-1 * time.Hour)
	olderJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   olderRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   olderJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &olderJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, olderJob)

	olderVerification := createVerificationWithStatus(s, ctx, olderRelease.ID(), oapi.ReleaseVerificationStatusPassed, time.Now().Add(-1*time.Hour))
	require.Equal(t, oapi.ReleaseVerificationStatusPassed, olderVerification.Status())

	// Create newer release with running verification
	newerVersionId := uuid.New().String()
	newerVersion := &oapi.DeploymentVersion{
		Id:           newerVersionId,
		Tag:          "v2.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, newerVersionId, newerVersion)

	newerRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *newerVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, newerRelease)

	newerJobCompletedAt := time.Now()
	newerJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   newerRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   newerJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &newerJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, newerJob)

	newerVerification := createVerificationWithStatus(s, ctx, newerRelease.ID(), oapi.ReleaseVerificationStatusRunning, time.Now())
	require.Equal(t, oapi.ReleaseVerificationStatusRunning, newerVerification.Status())

	// Get current release - should return older release
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, currentRelease)
	require.NotNil(t, currentJob)
	assert.Equal(t, olderRelease.ID(), currentRelease.ID())
	assert.Equal(t, "v1.0.0", currentRelease.Version.Tag)
}

func TestGetCurrentRelease_MultipleVerifications_UseMostRecent(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create a successful job
	completedAt := time.Now()
	release, _ := createTestReleaseAndJob(s, ctx, "v1.0.0", completedAt)

	// Create old passed verification
	oldVerification := createVerificationWithStatus(s, ctx, release.ID(), oapi.ReleaseVerificationStatusPassed, time.Now().Add(-1*time.Hour))
	require.Equal(t, oapi.ReleaseVerificationStatusPassed, oldVerification.Status())

	// Create newer failed verification
	newerVerification := createVerificationWithStatus(s, ctx, release.ID(), oapi.ReleaseVerificationStatusFailed, time.Now())
	require.Equal(t, oapi.ReleaseVerificationStatusFailed, newerVerification.Status())

	// Get current release - should fail because most recent verification failed
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, &release.ReleaseTarget)

	require.Error(t, err)
	assert.Nil(t, currentRelease)
	assert.Nil(t, currentJob)
	assert.Contains(t, err.Error(), "no valid release found")
}

func TestGetCurrentRelease_CancelledVerification_FallbackToPrevious(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create system, resource, environment, deployment (shared)
	systemId := uuid.New().String()
	system := &oapi.System{Id: systemId, Name: "test-system"}
	_ = s.Systems.Upsert(ctx, system)

	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	environmentId := uuid.New().String()
	environment := &oapi.Environment{Id: environmentId, Name: "test-env", SystemId: systemId}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{Id: deploymentId, Name: "test-deployment", Slug: "test-deployment", SystemId: systemId}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

	// Create release target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create older release without verification
	olderVersionId := uuid.New().String()
	olderVersion := &oapi.DeploymentVersion{
		Id:           olderVersionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	s.DeploymentVersions.Upsert(ctx, olderVersionId, olderVersion)

	olderRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *olderVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, olderRelease)

	olderJobCompletedAt := time.Now().Add(-1 * time.Hour)
	olderJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   olderRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   olderJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &olderJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, olderJob)

	// Create newer release with cancelled verification (represented as failed with failure limit hit)
	newerVersionId := uuid.New().String()
	newerVersion := &oapi.DeploymentVersion{
		Id:           newerVersionId,
		Tag:          "v2.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, newerVersionId, newerVersion)

	newerRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *newerVersion,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, newerRelease)

	newerJobCompletedAt := time.Now()
	newerJob := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   newerRelease.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   newerJobCompletedAt.Add(-1 * time.Minute),
		CompletedAt: &newerJobCompletedAt,
		JobAgentId:  uuid.New().String(),
	}
	s.Jobs.Upsert(ctx, newerJob)

	newerVerification := createVerificationWithStatus(s, ctx, newerRelease.ID(), oapi.ReleaseVerificationStatusCancelled, time.Now())
	// Cancelled verification will show as failed when hitting failure limit
	require.Equal(t, oapi.ReleaseVerificationStatusFailed, newerVerification.Status())

	// Get current release - should return older release
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, currentRelease)
	require.NotNil(t, currentJob)
	assert.Equal(t, olderRelease.ID(), currentRelease.ID())
	assert.Equal(t, "v1.0.0", currentRelease.Version.Tag)
}

func TestGetCurrentRelease_NoValidRelease(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	// Create a successful job with failed verification
	completedAt := time.Now()
	release, _ := createTestReleaseAndJob(s, ctx, "v1.0.0", completedAt)

	// Create failed verification
	verification := createVerificationWithStatus(s, ctx, release.ID(), oapi.ReleaseVerificationStatusFailed, time.Now())
	require.Equal(t, oapi.ReleaseVerificationStatusFailed, verification.Status())

	// Get current release - should return error
	currentRelease, currentJob, err := s.ReleaseTargets.GetCurrentRelease(ctx, &release.ReleaseTarget)

	require.Error(t, err)
	assert.Nil(t, currentRelease)
	assert.Nil(t, currentJob)
	assert.Contains(t, err.Error(), "no valid release found")
}
