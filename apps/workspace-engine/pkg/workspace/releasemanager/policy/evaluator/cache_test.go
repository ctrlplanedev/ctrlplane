package evaluator

import (
	"context"
	"sync"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"

	"github.com/stretchr/testify/assert"
)

// MockEvaluator for testing
type MockEvaluator struct {
	callCount   int
	mu          sync.Mutex
	scopeFields ScopeFields
}

func (m *MockEvaluator) Evaluate(ctx context.Context, scope EvaluatorScope) *oapi.RuleEvaluation {
	m.mu.Lock()
	m.callCount++
	m.mu.Unlock()
	return results.NewAllowedResult("Mock evaluation")
}

func (m *MockEvaluator) ScopeFields() ScopeFields {
	return m.scopeFields
}

func (m *MockEvaluator) RuleType() string {
	return "mock"
}

func (m *MockEvaluator) RuleId() string {
	return "mock"
}

func (m *MockEvaluator) Complexity() int {
	return 1
}

func (m *MockEvaluator) GetCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.callCount
}

func TestMemoizedEvaluator_CachesOnScopeFields(t *testing.T) {
	ctx := context.Background()

	env := &oapi.Environment{Id: "env-1"}
	version := &oapi.DeploymentVersion{Id: "v1.0.0"}
	res1 := &oapi.Resource{Id: "r1"}
	res2 := &oapi.Resource{Id: "r2"}
	dep := &oapi.Deployment{Id: "d1"}

	t.Run("caches on Environment+Version only", func(t *testing.T) {
		mock := &MockEvaluator{scopeFields: ScopeEnvironment | ScopeVersion}
		memoized := NewMemoized(mock, ScopeEnvironment|ScopeVersion)

		// Call with target1
		scope1 := EvaluatorScope{Environment: env, Version: version, Resource: res1, Deployment: dep}
		result1 := memoized.Evaluate(ctx, scope1)

		// Call with target2 - should hit cache (target doesn't matter)
		scope2 := EvaluatorScope{Environment: env, Version: version, Resource: res2, Deployment: dep}
		result2 := memoized.Evaluate(ctx, scope2)

		// Should only evaluate once
		assert.Equal(t, 1, mock.GetCallCount(), "should evaluate only once")

		// Should return same instance
		assert.Same(t, result1, result2, "should return cached result (same instance)")
	})

	t.Run("caches on Environment+Version+ReleaseTarget", func(t *testing.T) {
		mock := &MockEvaluator{scopeFields: ScopeEnvironment | ScopeVersion | ScopeReleaseTarget}
		memoized := NewMemoized(mock, ScopeEnvironment|ScopeVersion|ScopeReleaseTarget)

		// Call with target1
		scope1 := EvaluatorScope{Environment: env, Version: version, Resource: res1, Deployment: dep}
		result1 := memoized.Evaluate(ctx, scope1)

		// Call with target2 - should NOT hit cache (different resource)
		scope2 := EvaluatorScope{Environment: env, Version: version, Resource: res2, Deployment: dep}
		result2 := memoized.Evaluate(ctx, scope2)

		// Call with target1 again - should hit cache
		result3 := memoized.Evaluate(ctx, scope1)

		// Should evaluate twice (once for each unique target)
		assert.Equal(t, 2, mock.GetCallCount(), "should evaluate twice for different targets")

		// First and third should be same instance (cached)
		assert.Same(t, result1, result3, "should return cached result for target1")

		// First and second should be different instances
		assert.NotSame(t, result1, result2, "should return different results for different targets")
	})
}

func TestMemoizedEvaluator_MissingFields(t *testing.T) {
	ctx := context.Background()

	t.Run("denies when required Environment is missing", func(t *testing.T) {
		mock := &MockEvaluator{scopeFields: ScopeEnvironment | ScopeVersion}
		memoized := NewMemoized(mock, ScopeEnvironment|ScopeVersion)

		scope := EvaluatorScope{
			Version: &oapi.DeploymentVersion{Id: "v1.0.0"},
			// Environment is nil
		}

		result := memoized.Evaluate(ctx, scope)

		assert.Equal(t, 0, mock.GetCallCount(), "should not evaluate when required field is missing")
		assert.False(t, result.Allowed, "should deny when required field is missing")
		assert.NotEmpty(t, result.Message, "should have error message about missing fields")
	})

	t.Run("denies when required Version is missing", func(t *testing.T) {
		mock := &MockEvaluator{scopeFields: ScopeEnvironment | ScopeVersion}
		memoized := NewMemoized(mock, ScopeEnvironment|ScopeVersion)

		scope := EvaluatorScope{
			Environment: &oapi.Environment{Id: "env-1"},
			// Version is nil
		}

		result := memoized.Evaluate(ctx, scope)

		assert.Equal(t, 0, mock.GetCallCount(), "should not evaluate")
		assert.False(t, result.Allowed, "should deny")
	})

	t.Run("allows when required fields are present", func(t *testing.T) {
		mock := &MockEvaluator{scopeFields: ScopeVersion}
		memoized := NewMemoized(mock, ScopeVersion)

		target := &oapi.ReleaseTarget{ResourceId: "r1", EnvironmentId: "env-1", DeploymentId: "d1"}
		scope := EvaluatorScope{
			Version:     &oapi.DeploymentVersion{Id: "v1.0.0"},
			Environment: &oapi.Environment{Id: target.EnvironmentId},
			Resource:    &oapi.Resource{Id: target.ResourceId},
			Deployment:  &oapi.Deployment{Id: target.DeploymentId},
		}

		result := memoized.Evaluate(ctx, scope)

		assert.Equal(t, 1, mock.GetCallCount(), "should evaluate")
		assert.True(t, result.Allowed, "should allow when required fields are present")
	})
}

func TestMemoizedEvaluator_BuildCacheKey(t *testing.T) {
	env := &oapi.Environment{Id: "env-1"}
	version := &oapi.DeploymentVersion{Id: "v1.0.0"}
	target := &oapi.ReleaseTarget{ResourceId: "r1", EnvironmentId: "env-1", DeploymentId: "d1"}

	tests := []struct {
		name        string
		scopeFields ScopeFields
		scope       EvaluatorScope
		wantSame    bool
		scope2      EvaluatorScope
	}{
		{
			name:        "same key for same environment+version",
			scopeFields: ScopeEnvironment | ScopeVersion,
			scope:       EvaluatorScope{Environment: env, Version: version, Resource: &oapi.Resource{Id: target.ResourceId}, Deployment: &oapi.Deployment{Id: target.DeploymentId}},
			scope2:      EvaluatorScope{Environment: env, Version: version},
			wantSame:    true,
		},
		{
			name:        "different key for different version",
			scopeFields: ScopeVersion,
			scope:       EvaluatorScope{Version: version},
			scope2:      EvaluatorScope{Version: &oapi.DeploymentVersion{Id: "v2.0.0"}},
			wantSame:    false,
		},
		{
			name:        "workspace scope when no fields specified",
			scopeFields: 0,
			scope:       EvaluatorScope{Environment: env, Version: version},
			scope2:      EvaluatorScope{},
			wantSame:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &MockEvaluator{scopeFields: tt.scopeFields}
			memoized := NewMemoized(mock, tt.scopeFields)

			key1 := memoized.buildCacheKey(tt.scope)
			key2 := memoized.buildCacheKey(tt.scope2)

			if tt.wantSame {
				assert.Equal(t, key1, key2, "expected same cache key")
			} else {
				assert.NotEqual(t, key1, key2, "expected different cache keys")
			}
		})
	}
}

func TestMemoizedEvaluator_ScopeFieldsString(t *testing.T) {
	tests := []struct {
		name        string
		scopeFields ScopeFields
		want        string
	}{
		{
			name:        "single field",
			scopeFields: ScopeVersion,
			want:        "Version",
		},
		{
			name:        "two fields",
			scopeFields: ScopeEnvironment | ScopeVersion,
			want:        "Environment+Version",
		},
		{
			name:        "all fields",
			scopeFields: ScopeEnvironment | ScopeVersion | ScopeReleaseTarget,
			want:        "Environment+Version+Resource+Deployment",
		},
		{
			name:        "no fields",
			scopeFields: 0,
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &MockEvaluator{scopeFields: tt.scopeFields}
			memoized := NewMemoized(mock, tt.scopeFields)

			got := memoized.scopeFieldsString()
			assert.Equal(t, tt.want, got, "scopeFieldsString() mismatch")
		})
	}
}

func TestMemoizedEvaluator_ThreadSafety(t *testing.T) {
	ctx := context.Background()
	mock := &MockEvaluator{scopeFields: ScopeVersion}
	memoized := NewMemoized(mock, ScopeVersion)

	version := &oapi.DeploymentVersion{Id: "v1.0.0"}
	scope := EvaluatorScope{Version: version}

	// Run multiple goroutines accessing the same cache key
	var wg sync.WaitGroup
	numGoroutines := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result := memoized.Evaluate(ctx, scope)
			assert.NotNil(t, result, "should not return nil result")
		}()
	}

	wg.Wait()

	// Should only evaluate once despite 100 concurrent calls
	assert.Equal(t, 1, mock.GetCallCount(), "should evaluate only once despite concurrent calls")
}
