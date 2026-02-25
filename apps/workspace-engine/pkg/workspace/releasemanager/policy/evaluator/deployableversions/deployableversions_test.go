package deployableversions

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupStore creates a test store.
func setupStore() *store.Store {
	sc := statechange.NewChangeSet[any]()
	return store.New("test-workspace", sc)
}

func TestDeployableVersionStatusEvaluator_ReadyVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)
	require.NotNil(t, eval, "evaluator should not be nil")

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed for ready version")
	assert.Equal(t, "Version is ready", result.Message)
	assert.Equal(t, "version-1", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusReady, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_PausedVersionWithoutRelease(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-2",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert - paused without existing release should be denied
	assert.False(t, result.Allowed, "expected denied for paused version without existing release")
	assert.Equal(t, "Version is paused and has no active release for this target", result.Message)
	assert.Equal(t, "version-2", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusPaused, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_PausedVersionWithRelease(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:     "version-3",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Create an existing release for this paused version
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *releaseTarget,
	}
	_ = st.Releases.Upsert(ctx, release)

	eval := NewEvaluatorFromStore(st)

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert - paused with existing release should be allowed (grandfathered in)
	assert.True(t, result.Allowed, "expected allowed for paused version with existing release")
	assert.Equal(t, "Version is paused but has an active release for this target", result.Message)
	assert.Equal(t, "version-3", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusPaused, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_BuildingVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-4",
		Status: oapi.DeploymentVersionStatusBuilding,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for building version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-4", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusBuilding, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_FailedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-5",
		Status: oapi.DeploymentVersionStatusFailed,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for failed version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-5", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusFailed, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_RejectedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-6",
		Status: oapi.DeploymentVersionStatusRejected,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for rejected version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-6", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusRejected, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_UnspecifiedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-7",
		Status: oapi.DeploymentVersionStatusUnspecified,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for unspecified version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-7", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusUnspecified, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_Caching(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	// Create different scopes with the same version and target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope1 := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	scope2 := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}

	// Both should return the same result (cached)
	result1 := eval.Evaluate(context.Background(), scope1)
	result2 := eval.Evaluate(context.Background(), scope2)

	assert.True(t, result1.Allowed, "first evaluation should be allowed")
	assert.True(t, result2.Allowed, "second evaluation should be cached and allowed")
	assert.Equal(t, result1.Message, result2.Message, "messages should match")
}

func TestDeployableVersionStatusEvaluator_DifferentVersionsNotCached(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	readyVersion := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}
	pausedVersion := &oapi.DeploymentVersion{
		Id:     "version-2",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope1 := evaluator.EvaluatorScope{
		Version:     readyVersion,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	scope2 := evaluator.EvaluatorScope{
		Version:     pausedVersion,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}

	result1 := eval.Evaluate(context.Background(), scope1)
	result2 := eval.Evaluate(context.Background(), scope2)

	// Different versions should have different results
	assert.True(t, result1.Allowed, "ready version should be allowed")
	assert.False(t, result2.Allowed, "paused version without release should not be allowed")
	assert.NotEqual(t, result1.Message, result2.Message, "messages should differ")
}

func TestDeployableVersionStatusEvaluator_MissingFields(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	// Scope without version - should be denied by memoization wrapper
	rt := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}
	scope := evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert - should be denied due to missing required field
	assert.False(t, result.Allowed, "expected denied when version is missing")
	assert.Contains(t, result.Message, "missing", "message should indicate missing fields")
}

func TestDeployableVersionStatusEvaluator_ScopeFields(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	// Verify that the evaluator declares it needs Version and ReleaseTarget
	scopeFields := eval.ScopeFields()
	expected := evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
	assert.Equal(t, expected, scopeFields, "should require Version+ReleaseTarget scope fields")
}

func TestDeployableVersionStatusEvaluator_ResultStructure(t *testing.T) {
	st := setupStore()
	eval := NewEvaluatorFromStore(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Verify result structure
	require.NotNil(t, result.Details, "details should be initialized")
	assert.Contains(t, result.Details, "version_id", "should contain version_id")
	assert.Contains(t, result.Details, "version_status", "should contain version_status")
	assert.NotEmpty(t, result.Message, "message should be set")
}

// TestDeployableVersionStatusEvaluator_PausedVersionMultipleTargets tests that a paused
// version is allowed on targets where it has releases, but denied on others
func TestDeployableVersionStatusEvaluator_PausedVersionMultipleTargets(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	target1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	target2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Create release for target1 only
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target1,
	}
	_ = st.Releases.Upsert(ctx, release)

	eval := NewEvaluatorFromStore(st)

	// Test target1 (has release) - should be allowed
	scope1 := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target1.EnvironmentId},
		Resource:    &oapi.Resource{Id: target1.ResourceId},
		Deployment:  &oapi.Deployment{Id: target1.DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "paused version with release should be allowed on target1")

	// Test target2 (no release) - should be denied
	scope2 := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target2.EnvironmentId},
		Resource:    &oapi.Resource{Id: target2.ResourceId},
		Deployment:  &oapi.Deployment{Id: target2.DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.False(t, result2.Allowed, "paused version without release should be denied on target2")
}

// TestDeployableVersionStatusEvaluator_StatusTransitions tests various status transitions
func TestDeployableVersionStatusEvaluator_StatusTransitions(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Step 1: Start with ready version - should be allowed
	version1 := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	eval := NewEvaluatorFromStore(st)

	scope1 := evaluator.EvaluatorScope{
		Version:     version1,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(ctx, scope1)
	assert.True(t, result.Allowed, "ready version should be allowed")

	// Step 2: Different version that's paused without release - should be denied
	version2 := &oapi.DeploymentVersion{
		Id:     "version-2",
		Status: oapi.DeploymentVersionStatusPaused,
	}
	scope2 := evaluator.EvaluatorScope{
		Version:     version2,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result = eval.Evaluate(ctx, scope2)
	assert.False(t, result.Allowed, "paused version without release should be denied")

	// Step 3: Add release for paused version, then evaluate again - should be allowed
	release := &oapi.Release{
		Version:       *version2,
		ReleaseTarget: *releaseTarget,
	}
	_ = st.Releases.Upsert(ctx, release)

	// Need fresh evaluator due to memoization
	eval = NewEvaluatorFromStore(st)
	result = eval.Evaluate(ctx, scope2)
	assert.True(t, result.Allowed, "paused version with release should be allowed")

	// Step 4: Another ready version - should always be allowed
	version3 := &oapi.DeploymentVersion{
		Id:     "version-3",
		Status: oapi.DeploymentVersionStatusReady,
	}
	scope3 := evaluator.EvaluatorScope{
		Version:     version3,
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result = eval.Evaluate(ctx, scope3)
	assert.True(t, result.Allowed, "ready version should always be allowed")
}

// TestDeployableVersionStatusEvaluator_PausedWithMultipleReleases tests that paused
// versions work correctly when there are multiple releases in the system
func TestDeployableVersionStatusEvaluator_PausedWithMultipleReleases(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	pausedVersion := &oapi.DeploymentVersion{
		Id:     "paused-version",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	readyVersion := &oapi.DeploymentVersion{
		Id:     "ready-version",
		Status: oapi.DeploymentVersionStatusReady,
	}

	target1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	target2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Create releases: paused version on target1, ready version on target2
	release1 := &oapi.Release{
		Version:       *pausedVersion,
		ReleaseTarget: *target1,
	}
	release2 := &oapi.Release{
		Version:       *readyVersion,
		ReleaseTarget: *target2,
	}
	_ = st.Releases.Upsert(ctx, release1)
	_ = st.Releases.Upsert(ctx, release2)

	eval := NewEvaluatorFromStore(st)

	// Paused version on target1 (has release) - allowed
	scope1 := evaluator.EvaluatorScope{
		Version:     pausedVersion,
		Environment: &oapi.Environment{Id: target1.EnvironmentId},
		Resource:    &oapi.Resource{Id: target1.ResourceId},
		Deployment:  &oapi.Deployment{Id: target1.DeploymentId},
	}
	result1 := eval.Evaluate(ctx, scope1)
	assert.True(t, result1.Allowed, "paused version should be allowed on target with its release")

	// Paused version on target2 (has different version's release) - denied
	scope2 := evaluator.EvaluatorScope{
		Version:     pausedVersion,
		Environment: &oapi.Environment{Id: target2.EnvironmentId},
		Resource:    &oapi.Resource{Id: target2.ResourceId},
		Deployment:  &oapi.Deployment{Id: target2.DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)
	assert.False(t, result2.Allowed, "paused version should be denied on target without its release")

	// Ready version on target2 - allowed
	scope3 := evaluator.EvaluatorScope{
		Version:     readyVersion,
		Environment: &oapi.Environment{Id: target2.EnvironmentId},
		Resource:    &oapi.Resource{Id: target2.ResourceId},
		Deployment:  &oapi.Deployment{Id: target2.DeploymentId},
	}
	result3 := eval.Evaluate(ctx, scope3)
	assert.True(t, result3.Allowed, "ready version should always be allowed")
}

// TestDeployableVersionStatusEvaluator_PausedVersionDifferentEnvironments tests
// paused versions across multiple environments
func TestDeployableVersionStatusEvaluator_PausedVersionDifferentEnvironments(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	devTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "dev",
		DeploymentId:  "deployment-1",
	}

	prodTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "prod",
		DeploymentId:  "deployment-1",
	}

	// Create release for dev only
	devRelease := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *devTarget,
	}
	_ = st.Releases.Upsert(ctx, devRelease)

	eval := NewEvaluatorFromStore(st)

	// Dev environment (has release) - allowed
	devScope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: devTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: devTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: devTarget.DeploymentId},
	}
	devResult := eval.Evaluate(ctx, devScope)
	assert.True(t, devResult.Allowed, "paused version should be allowed in dev (has release)")

	// Prod environment (no release) - denied
	prodScope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: prodTarget.EnvironmentId},
		Resource:    &oapi.Resource{Id: prodTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: prodTarget.DeploymentId},
	}
	prodResult := eval.Evaluate(ctx, prodScope)
	assert.False(t, prodResult.Allowed, "paused version should be denied in prod (no release)")
}

// TestDeployableVersionStatusEvaluator_EmptyStoreHandling tests that paused versions
// work correctly when the store has no releases
func TestDeployableVersionStatusEvaluator_EmptyStoreHandling(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	target := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Store is empty (no releases)
	eval := NewEvaluatorFromStore(st)

	scope := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target.EnvironmentId},
		Resource:    &oapi.Resource{Id: target.ResourceId},
		Deployment:  &oapi.Deployment{Id: target.DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	// Should be denied (no releases exist)
	assert.False(t, result.Allowed, "paused version should be denied when no releases exist")
	assert.Contains(t, result.Message, "no active release", "message should indicate no active release")
}

// TestDeployableVersionStatusEvaluator_WrongVersionRelease tests that a paused version
// is denied even when releases exist for other versions
func TestDeployableVersionStatusEvaluator_WrongVersionRelease(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	pausedVersion := &oapi.DeploymentVersion{
		Id:     "paused-version",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	otherVersion := &oapi.DeploymentVersion{
		Id:     "other-version",
		Status: oapi.DeploymentVersionStatusReady,
	}

	target := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Create release for OTHER version
	release := &oapi.Release{
		Version:       *otherVersion,
		ReleaseTarget: *target,
	}
	_ = st.Releases.Upsert(ctx, release)

	eval := NewEvaluatorFromStore(st)

	scope := evaluator.EvaluatorScope{
		Version:     pausedVersion,
		Environment: &oapi.Environment{Id: target.EnvironmentId},
		Resource:    &oapi.Resource{Id: target.ResourceId},
		Deployment:  &oapi.Deployment{Id: target.DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	// Should be denied (no release for THIS version)
	assert.False(t, result.Allowed, "paused version should be denied when release exists for different version")
	assert.Contains(t, result.Message, "no active release", "message should indicate no active release for this version")
}

// TestDeployableVersionStatusEvaluator_PausedVersionCaching tests that caching
// works correctly for paused versions with different targets
func TestDeployableVersionStatusEvaluator_PausedVersionCaching(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	target1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	target2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	// Create release for target1
	release := &oapi.Release{
		Version:       *version,
		ReleaseTarget: *target1,
	}
	_ = st.Releases.Upsert(ctx, release)

	eval := NewEvaluatorFromStore(st)

	// Evaluate for target1 twice - should be cached
	scope1a := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target1.EnvironmentId},
		Resource:    &oapi.Resource{Id: target1.ResourceId},
		Deployment:  &oapi.Deployment{Id: target1.DeploymentId},
	}
	scope1b := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target1.EnvironmentId},
		Resource:    &oapi.Resource{Id: target1.ResourceId},
		Deployment:  &oapi.Deployment{Id: target1.DeploymentId},
	}

	result1a := eval.Evaluate(ctx, scope1a)
	result1b := eval.Evaluate(ctx, scope1b)
	assert.Equal(t, result1a.Allowed, result1b.Allowed, "results should be cached for same target")
	assert.Equal(t, result1a.Message, result1b.Message, "cached results should have same message")

	// Evaluate for target2 - should NOT use target1's cache (different target)
	scope2 := evaluator.EvaluatorScope{
		Version:     version,
		Environment: &oapi.Environment{Id: target2.EnvironmentId},
		Resource:    &oapi.Resource{Id: target2.ResourceId},
		Deployment:  &oapi.Deployment{Id: target2.DeploymentId},
	}
	result2 := eval.Evaluate(ctx, scope2)

	// Different results for different targets
	assert.True(t, result1a.Allowed, "target1 should be allowed (has release)")
	assert.False(t, result2.Allowed, "target2 should be denied (no release)")
	assert.NotEqual(t, result1a.Message, result2.Message, "different targets should have different results")
}

// TestDeployableVersionStatusEvaluator_AllStatusesComprehensive tests all possible
// version statuses with and without releases
func TestDeployableVersionStatusEvaluator_AllStatusesComprehensive(t *testing.T) {
	st := setupStore()
	ctx := context.Background()

	target := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-1",
		DeploymentId:  "deployment-1",
	}

	statuses := []struct {
		status          oapi.DeploymentVersionStatus
		expectedAllowed bool
		description     string
	}{
		{oapi.DeploymentVersionStatusReady, true, "ready should be allowed"},
		{oapi.DeploymentVersionStatusBuilding, false, "building should be denied"},
		{oapi.DeploymentVersionStatusFailed, false, "failed should be denied"},
		{oapi.DeploymentVersionStatusRejected, false, "rejected should be denied"},
		{oapi.DeploymentVersionStatusUnspecified, false, "unspecified should be denied"},
		{oapi.DeploymentVersionStatusPaused, false, "paused without release should be denied"},
	}

	eval := NewEvaluatorFromStore(st)

	for i, tc := range statuses {
		t.Run(string(tc.status), func(t *testing.T) {
			version := &oapi.DeploymentVersion{
				Id:     "version-" + string(tc.status),
				Status: tc.status,
			}

			scope := evaluator.EvaluatorScope{
				Version:     version,
				Environment: &oapi.Environment{Id: target.EnvironmentId},
				Resource:    &oapi.Resource{Id: target.ResourceId},
				Deployment:  &oapi.Deployment{Id: target.DeploymentId},
			}

			result := eval.Evaluate(ctx, scope)
			assert.Equal(t, tc.expectedAllowed, result.Allowed, tc.description)

			// For paused status, also test with release
			if tc.status == oapi.DeploymentVersionStatusPaused {
				release := &oapi.Release{
					Version:       *version,
					ReleaseTarget: *target,
				}
				_ = st.Releases.Upsert(ctx, release)

				// Need fresh evaluator due to memoization
				evalWithRelease := NewEvaluatorFromStore(st)
				resultWithRelease := evalWithRelease.Evaluate(ctx, scope)
				assert.True(t, resultWithRelease.Allowed, "paused with release should be allowed")

				// Clean up for next iteration
				st = setupStore()
				eval = NewEvaluatorFromStore(st)
			}

			// Verify all results have proper details
			assert.Contains(t, result.Details, "version_id", "result should contain version_id for status %s (iteration %d)", tc.status, i)
			assert.Contains(t, result.Details, "version_status", "result should contain version_status for status %s (iteration %d)", tc.status, i)
		})
	}
}
