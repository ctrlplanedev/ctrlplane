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
	eval := NewEvaluator(st)
	require.NotNil(t, eval, "evaluator should not be nil")

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed for ready version")
	assert.Equal(t, "Version is ready", result.Message)
	assert.Equal(t, "version-1", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusReady, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_PausedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-2",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert - paused should return pending, not allowed or denied
	assert.False(t, result.Allowed, "expected not allowed for paused version")
	assert.Equal(t, "Version is paused", result.Message)
	assert.Equal(t, "version-2", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusPaused, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_BuildingVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-3",
		Status: oapi.DeploymentVersionStatusBuilding,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for building version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-3", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusBuilding, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_FailedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-4",
		Status: oapi.DeploymentVersionStatusFailed,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for failed version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-4", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusFailed, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_RejectedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-5",
		Status: oapi.DeploymentVersionStatusRejected,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for rejected version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-5", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusRejected, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_UnspecifiedVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-6",
		Status: oapi.DeploymentVersionStatusUnspecified,
	}

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert
	assert.False(t, result.Allowed, "expected denied for unspecified version")
	assert.Equal(t, "Version is not ready", result.Message)
	assert.Equal(t, "version-6", result.Details["version_id"])
	assert.Equal(t, oapi.DeploymentVersionStatusUnspecified, result.Details["version_status"])
}

func TestDeployableVersionStatusEvaluator_Caching(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	// Create different scopes with the same version but different environments
	// Since this evaluator only cares about Version, it should cache based on version only
	env1 := &oapi.Environment{Id: "env-1", Name: "prod"}
	env2 := &oapi.Environment{Id: "env-2", Name: "staging"}

	scope1 := evaluator.EvaluatorScope{
		Environment: env1,
		Version:     version,
	}
	scope2 := evaluator.EvaluatorScope{
		Environment: env2,
		Version:     version,
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
	eval := NewEvaluator(st)

	readyVersion := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}
	pausedVersion := &oapi.DeploymentVersion{
		Id:     "version-2",
		Status: oapi.DeploymentVersionStatusPaused,
	}

	scope1 := evaluator.EvaluatorScope{Version: readyVersion}
	scope2 := evaluator.EvaluatorScope{Version: pausedVersion}

	result1 := eval.Evaluate(context.Background(), scope1)
	result2 := eval.Evaluate(context.Background(), scope2)

	// Different versions should have different results
	assert.True(t, result1.Allowed, "ready version should be allowed")
	assert.False(t, result2.Allowed, "paused version should not be allowed")
	assert.NotEqual(t, result1.Message, result2.Message, "messages should differ")
}

func TestDeployableVersionStatusEvaluator_MissingVersion(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	// Scope without version - should be denied by memoization wrapper
	scope := evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: "env-1"},
	}
	result := eval.Evaluate(context.Background(), scope)

	// Assert - should be denied due to missing required field
	assert.False(t, result.Allowed, "expected denied when version is missing")
	assert.Contains(t, result.Message, "missing", "message should indicate missing fields")
}

func TestDeployableVersionStatusEvaluator_ScopeFields(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	// Verify that the evaluator declares it only needs Version
	scopeFields := eval.ScopeFields()
	assert.Equal(t, evaluator.ScopeVersion, scopeFields, "should only require Version scope field")
}

func TestDeployableVersionStatusEvaluator_ResultStructure(t *testing.T) {
	st := setupStore()
	eval := NewEvaluator(st)

	version := &oapi.DeploymentVersion{
		Id:     "version-1",
		Status: oapi.DeploymentVersionStatusReady,
	}

	scope := evaluator.EvaluatorScope{Version: version}
	result := eval.Evaluate(context.Background(), scope)

	// Verify result structure
	require.NotNil(t, result.Details, "details should be initialized")
	assert.Contains(t, result.Details, "version_id", "should contain version_id")
	assert.Contains(t, result.Details, "version_status", "should contain version_status")
	assert.NotEmpty(t, result.Message, "message should be set")
}
