package store_test

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupStore() *store.Store {
	sc := statechange.NewChangeSet[any]()
	return store.New("test-workspace", sc)
}

func stringPtr(s string) *string {
	return &s
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func TestPolicySkips_CRUD(t *testing.T) {
	s := setupStore()
	ctx := context.Background()

	skip := &oapi.PolicySkip{
		Id:        "skip-1",
		VersionId: "version-1",
	}

	// Upsert
	s.PolicySkips.Upsert(ctx, skip)

	// Get
	result, ok := s.PolicySkips.Get("skip-1")
	require.True(t, ok)
	assert.Equal(t, "skip-1", result.Id)

	// Items
	items := s.PolicySkips.Items()
	assert.Len(t, items, 1)

	// Remove
	s.PolicySkips.Remove(ctx, "skip-1")
	_, ok = s.PolicySkips.Get("skip-1")
	assert.False(t, ok)

	// Remove non-existent - should not panic
	s.PolicySkips.Remove(ctx, "nonexistent")
}

func TestPolicySkips_GetForTarget(t *testing.T) {
	s := setupStore()
	ctx := context.Background()

	futureTime := time.Now().Add(1 * time.Hour)
	pastTime := time.Now().Add(-1 * time.Hour)

	// Create skips with different specificity levels
	exactSkip := &oapi.PolicySkip{
		Id:            "skip-exact",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    stringPtr("res-1"),
		ExpiresAt:     &futureTime,
	}

	envWildcardSkip := &oapi.PolicySkip{
		Id:            "skip-env-wildcard",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    nil, // wildcard
		ExpiresAt:     &futureTime,
	}

	fullWildcardSkip := &oapi.PolicySkip{
		Id:            "skip-full-wildcard",
		VersionId:     "v1",
		EnvironmentId: nil, // wildcard
		ResourceId:    nil, // wildcard
		ExpiresAt:     &futureTime,
	}

	expiredSkip := &oapi.PolicySkip{
		Id:            "skip-expired",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    stringPtr("res-1"),
		ExpiresAt:     &pastTime,
	}

	s.PolicySkips.Upsert(ctx, exactSkip)
	s.PolicySkips.Upsert(ctx, envWildcardSkip)
	s.PolicySkips.Upsert(ctx, fullWildcardSkip)
	s.PolicySkips.Upsert(ctx, expiredSkip)

	t.Run("exact match found", func(t *testing.T) {
		result := s.PolicySkips.GetForTarget("v1", "env-1", "res-1")
		require.NotNil(t, result)
		assert.Equal(t, "skip-exact", result.Id)
	})

	t.Run("environment wildcard found when no exact match", func(t *testing.T) {
		result := s.PolicySkips.GetForTarget("v1", "env-1", "res-2")
		require.NotNil(t, result)
		assert.Equal(t, "skip-env-wildcard", result.Id)
	})

	t.Run("full wildcard found when no env match", func(t *testing.T) {
		result := s.PolicySkips.GetForTarget("v1", "env-2", "res-2")
		require.NotNil(t, result)
		assert.Equal(t, "skip-full-wildcard", result.Id)
	})

	t.Run("no match for different version", func(t *testing.T) {
		result := s.PolicySkips.GetForTarget("v2", "env-1", "res-1")
		assert.Nil(t, result)
	})

	t.Run("expired skip not returned", func(t *testing.T) {
		// Remove non-expired skips to test expired behavior
		s.PolicySkips.Remove(ctx, "skip-exact")
		s.PolicySkips.Remove(ctx, "skip-env-wildcard")
		s.PolicySkips.Remove(ctx, "skip-full-wildcard")

		result := s.PolicySkips.GetForTarget("v1", "env-1", "res-1")
		assert.Nil(t, result)
	})
}

func TestPolicySkips_GetAllForTarget(t *testing.T) {
	s := setupStore()
	ctx := context.Background()

	futureTime := time.Now().Add(1 * time.Hour)
	pastTime := time.Now().Add(-1 * time.Hour)

	exactSkip := &oapi.PolicySkip{
		Id:            "skip-exact",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    stringPtr("res-1"),
		ExpiresAt:     &futureTime,
	}

	envWildcardSkip := &oapi.PolicySkip{
		Id:            "skip-env-wildcard",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    nil,
		ExpiresAt:     &futureTime,
	}

	fullWildcardSkip := &oapi.PolicySkip{
		Id:            "skip-full-wildcard",
		VersionId:     "v1",
		EnvironmentId: nil,
		ResourceId:    nil,
		ExpiresAt:     &futureTime,
	}

	expiredSkip := &oapi.PolicySkip{
		Id:            "skip-expired",
		VersionId:     "v1",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    stringPtr("res-1"),
		ExpiresAt:     &pastTime,
	}

	differentVersionSkip := &oapi.PolicySkip{
		Id:            "skip-diff-version",
		VersionId:     "v2",
		EnvironmentId: stringPtr("env-1"),
		ResourceId:    stringPtr("res-1"),
	}

	s.PolicySkips.Upsert(ctx, exactSkip)
	s.PolicySkips.Upsert(ctx, envWildcardSkip)
	s.PolicySkips.Upsert(ctx, fullWildcardSkip)
	s.PolicySkips.Upsert(ctx, expiredSkip)
	s.PolicySkips.Upsert(ctx, differentVersionSkip)

	t.Run("returns all matching non-expired skips", func(t *testing.T) {
		results := s.PolicySkips.GetAllForTarget("v1", "env-1", "res-1")
		// Should include exact, env-wildcard, and full-wildcard, but NOT expired
		assert.Len(t, results, 3)
	})

	t.Run("no match for different version", func(t *testing.T) {
		results := s.PolicySkips.GetAllForTarget("v3", "env-1", "res-1")
		assert.Len(t, results, 0)
	})

	t.Run("env wildcard matches different resource", func(t *testing.T) {
		results := s.PolicySkips.GetAllForTarget("v1", "env-1", "res-99")
		// env-wildcard (env-1, nil resource) and full-wildcard should match
		assert.GreaterOrEqual(t, len(results), 2)
	})
}

func TestWorkflowJobTemplates_CRUD(t *testing.T) {
	s := setupStore()
	ctx := context.Background()

	template := &oapi.WorkflowJobTemplate{
		Id:   "wjt-1",
		Name: "test-template",
	}

	// Upsert
	s.WorkflowJobTemplates.Upsert(ctx, template)

	// Get
	result, ok := s.WorkflowJobTemplates.Get("wjt-1")
	require.True(t, ok)
	assert.Equal(t, "wjt-1", result.Id)

	// Items
	items := s.WorkflowJobTemplates.Items()
	assert.Len(t, items, 1)

	// Remove
	s.WorkflowJobTemplates.Remove(ctx, "wjt-1")
	_, ok = s.WorkflowJobTemplates.Get("wjt-1")
	assert.False(t, ok)

	// Remove non-existent - should not panic
	s.WorkflowJobTemplates.Remove(ctx, "nonexistent")
}
