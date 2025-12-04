package verification_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/action"
	verificationaction "workspace-engine/pkg/workspace/releasemanager/action/verification"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStore() *store.Store {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	return store.New(wsId, changeset)
}

func createTestRelease(s *store.Store, ctx context.Context) *oapi.Release {
	// Create system
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}
	_ = s.Systems.Upsert(ctx, system)

	// Create resource
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	// Create environment
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: systemId,
	}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	// Create deployment
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: systemId,
	}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

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
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create release
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	return release
}

func TestVerificationAction_Name(t *testing.T) {
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	action := verificationaction.NewVerificationAction(verificationMgr)

	assert.Equal(t, "verification", action.Name())
}

func TestVerificationAction_Execute_NoMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{},
	}

	// Should not error when no metrics
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	_, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	assert.False(t, exists)
}

// Note: The following tests would work once the OpenAPI schema is updated with VerificationRule
// For now, they demonstrate the expected behavior

func TestVerificationAction_ExtractMetrics_Deduplication(t *testing.T) {
	// This test demonstrates that duplicate metric names should be deduplicated
	// Implementation is in extractVerificationMetrics method

	// When multiple policies define the same metric name,
	// only one instance should be included in the result
	t.Skip("Requires VerificationRule in PolicyRule - will work once OpenAPI schema is updated")
}

func TestVerificationAction_Execute_CreatesVerification(t *testing.T) {
	// This test would verify that verification is created when policies have verification rules
	t.Skip("Requires VerificationRule in PolicyRule - will work once OpenAPI schema is updated")
}

func TestVerificationAction_Execute_MultiplePolicies(t *testing.T) {
	// This test would verify that metrics from multiple policies are collected
	t.Skip("Requires VerificationRule in PolicyRule - will work once OpenAPI schema is updated")
}
