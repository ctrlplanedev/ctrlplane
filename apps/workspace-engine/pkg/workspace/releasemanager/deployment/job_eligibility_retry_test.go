package deployment

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper to create a selector that matches all resources/environments/deployments
func createMatchAllSelector() *oapi.Selector {
	selector := &oapi.Selector{}
	// Empty AND condition matches everything
	_ = selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]interface{}{
		"operator":   "and",
		"conditions": []interface{}{},
	}})
	return selector
}

// TestRetryPolicy_MultipleRules tests how multiple rules in a policy interact
func TestRetryPolicy_MultipleRules_FirstNoRetry_SecondHasRetry(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	ctx := context.Background()

	// Create deployment, environment for policy matching
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       "system-1",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "production",
		SystemId: "system-1",
	}
	_ = st.Environments.Upsert(ctx, environment)

	// Create a policy with multiple rules:
	// Rule 1: has approval (no retry)
	// Rule 2: has retry with maxRetries=3
	maxRetries := int32(3)

	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "multi-rule-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  "selector-1",
				DeploymentSelector:  createMatchAllSelector(),
				EnvironmentSelector: createMatchAllSelector(),
				ResourceSelector:    createMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				// No retry field - this rule doesn't define retry policy
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
			{
				Id:        "rule-2",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				// This rule has retry policy
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	checker := NewJobEligibilityChecker(st)
	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// First attempt should be allowed
	result, err := checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed(), "First attempt should be allowed")
	assert.Equal(t, "eligible", result.Reason)

	// Add a failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Second attempt should be allowed (1 failure <= 3 max retries)
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed(), "Second attempt should be allowed (retry policy from rule-2)")
	assert.Contains(t, result.Reason, "eligible")

	// Add 3 more failed jobs (total 4 jobs = exceeds maxRetries of 3)
	for i := 2; i <= 4; i++ {
		completedAt := time.Now()
		st.Jobs.Upsert(ctx, &oapi.Job{
			Id:          "job-" + string(rune(i)),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusFailure,
			CreatedAt:   time.Now(),
			CompletedAt: &completedAt,
		})
	}

	// Fifth attempt should be denied (4 attempts > 3 max retries)
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.False(t, result.IsAllowed(), "Fifth attempt should be denied (exceeds retry limit)")
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

// TestRetryPolicy_MultiplePolicies_MostRestrictiveWins tests that when multiple
// policies apply to the same release, the most restrictive retry limit wins
func TestRetryPolicy_MultiplePolicies_MostRestrictiveWins(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	ctx := context.Background()

	// Create deployment, environment
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       "system-1",
		JobAgentConfig: oapi.JobAgentConfig{},
		JobAgentId:     nil,
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "production",
		SystemId: "system-1",
	}
	_ = st.Environments.Upsert(ctx, environment)

	// Policy 1: allows 3 retries
	maxRetries1 := int32(3)
	policy1 := &oapi.Policy{
		Id:        "policy-1",
		Name:      "lenient-retry-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  "selector-1",
				DeploymentSelector:  createMatchAllSelector(),
				EnvironmentSelector: createMatchAllSelector(),
				ResourceSelector:    createMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries1,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy1)

	// Policy 2: allows only 1 retry (more restrictive)
	maxRetries2 := int32(1)
	policy2 := &oapi.Policy{
		Id:        "policy-2",
		Name:      "strict-retry-policy",
		Enabled:   true,
		Priority:  2,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  "selector-2",
				DeploymentSelector:  createMatchAllSelector(),
				EnvironmentSelector: createMatchAllSelector(),
				ResourceSelector:    createMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-2",
				PolicyId:  "policy-2",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries2,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy2)

	checker := NewJobEligibilityChecker(st)
	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// First attempt should be allowed
	result, err := checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())

	// Add first failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Second attempt should be allowed (1 failure <= 1 max retry from strict policy)
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed(), "Second attempt should be allowed")

	// Add second failed job
	completedAt2 := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt2,
	})

	// Third attempt should be DENIED because the stricter policy (maxRetries=1) blocks it
	// Even though the lenient policy would allow it (maxRetries=3), the most restrictive wins
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.False(t, result.IsAllowed(), "Third attempt should be denied (strict policy blocks it)")
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

// TestRetryPolicy_AllRulesNoRetry_UsesDefault tests that when a policy exists
// but none of its rules define retry, the default (no retries) is used
func TestRetryPolicy_AllRulesNoRetry_UsesDefault(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	ctx := context.Background()

	// Create deployment, environment
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       "system-1",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "production",
		SystemId: "system-1",
	}
	_ = st.Environments.Upsert(ctx, environment)

	// Policy with multiple rules but NO retry rules
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "no-retry-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  "selector-1",
				DeploymentSelector:  createMatchAllSelector(),
				EnvironmentSelector: createMatchAllSelector(),
				ResourceSelector:    createMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
				// No retry field
			},
			{
				Id:        "rule-2",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				// Also no retry field - just has gradual rollout
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 60,
					RolloutType:       oapi.GradualRolloutRuleRolloutTypeLinear,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	checker := NewJobEligibilityChecker(st)
	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// First attempt should be allowed
	result, err := checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())

	// Add a failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Second attempt should be DENIED (uses default maxRetries=0 behavior)
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.False(t, result.IsAllowed(), "Second attempt should be denied (default no retries)")
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

// TestRetryPolicy_DisabledPolicy_NotApplied tests that disabled policies
// are not considered for retry evaluation
func TestRetryPolicy_DisabledPolicy_NotApplied(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	ctx := context.Background()

	// Create deployment, environment
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       "system-1",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "production",
		SystemId: "system-1",
	}
	_ = st.Environments.Upsert(ctx, environment)

	// Disabled policy with retry rule
	maxRetries := int32(5)
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "disabled-retry-policy",
		Enabled:   false, // Disabled!
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  "selector-1",
				DeploymentSelector:  createMatchAllSelector(),
				EnvironmentSelector: createMatchAllSelector(),
				ResourceSelector:    createMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	checker := NewJobEligibilityChecker(st)
	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// First attempt should be allowed
	result, err := checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())

	// Add a failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Second attempt should be DENIED because disabled policy is ignored,
	// so it falls back to default (no retries)
	result, err = checker.ShouldCreateJob(ctx, release, nil)
	require.NoError(t, err)
	assert.False(t, result.IsAllowed(), "Second attempt should be denied (policy disabled, uses default)")
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}
