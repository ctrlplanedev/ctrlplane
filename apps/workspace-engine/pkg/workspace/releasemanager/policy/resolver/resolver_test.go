package resolver

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

func TestPolicyResolver_GetRules_RetryRules(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system, environment, deployment, resource
	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create a policy with retry rules
	maxRetries1 := int32(3)
	maxRetries2 := int32(5)
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "retry-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries1,
				},
			},
			{
				Id:        "rule-2",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries2,
				},
			},
			{
				Id:        "rule-3",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				// No retry rule - has approval instead
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)

	require.NoError(t, err)
	assert.Len(t, rules, 2, "Should extract 2 retry rules")

	// Verify rule content
	assert.Equal(t, maxRetries1, rules[0].Rule.MaxRetries)
	assert.Equal(t, maxRetries2, rules[1].Rule.MaxRetries)
	assert.Equal(t, "rule-1", rules[0].RuleId)
	assert.Equal(t, "rule-2", rules[1].RuleId)
	assert.Equal(t, "policy-1", rules[0].PolicyId)
	assert.Equal(t, "retry-policy", rules[0].PolicyName)
	assert.Equal(t, 1, rules[0].Priority)
}

func TestPolicyResolver_GetRules_NoMatchingRules(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system, environment, deployment, resource
	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create a policy with NO retry rules
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "approval-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)

	require.NoError(t, err)
	assert.Len(t, rules, 0, "Should extract 0 retry rules when none exist")
}

func TestPolicyResolver_GetRules_DisabledPolicy(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system, environment, deployment, resource
	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create a DISABLED policy with retry rules
	maxRetries := int32(3)
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "disabled-retry-policy",
		Enabled:   false, // Disabled!
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
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

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)

	require.NoError(t, err)
	assert.Len(t, rules, 0, "Should not extract rules from disabled policies")
}

func TestPolicyResolver_GetRules_MultiplePolicies(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system, environment, deployment, resource
	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create multiple policies with retry rules
	maxRetries1 := int32(3)
	policy1 := &oapi.Policy{
		Id:        "policy-1",
		Name:      "lenient-retry",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
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

	maxRetries2 := int32(1)
	policy2 := &oapi.Policy{
		Id:        "policy-2",
		Name:      "strict-retry",
		Enabled:   true,
		Priority:  2,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
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

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)

	require.NoError(t, err)
	assert.Len(t, rules, 2, "Should extract rules from both policies")

	// Verify rules from both policies are present
	policyNames := []string{rules[0].PolicyName, rules[1].PolicyName}
	assert.Contains(t, policyNames, "lenient-retry")
	assert.Contains(t, policyNames, "strict-retry")
}

func TestPolicyResolver_GetRules_SelectorFilters(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "web-app",
		Slug:           "web-app",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	maxRetries := int32(3)

	// Policy that matches — selector targets deployment name "web-app"
	matchingPolicy := &oapi.Policy{
		Id:        "policy-match",
		Name:      "matching-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "deployment.name == 'web-app'",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-match",
				PolicyId:  "policy-match",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry:     &oapi.RetryRule{MaxRetries: maxRetries},
			},
		},
	}
	st.Policies.Upsert(ctx, matchingPolicy)

	// Policy that does NOT match — selector targets deployment name "api-server"
	nonMatchingPolicy := &oapi.Policy{
		Id:        "policy-no-match",
		Name:      "non-matching-policy",
		Enabled:   true,
		Priority:  2,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "deployment.name == 'api-server'",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-no-match",
				PolicyId:  "policy-no-match",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry:     &oapi.RetryRule{MaxRetries: int32(5)},
			},
		},
	}
	st.Policies.Upsert(ctx, nonMatchingPolicy)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)
	require.NoError(t, err)
	assert.Len(t, rules, 1, "Should only return rules from the matching policy")
	assert.Equal(t, "matching-policy", rules[0].PolicyName)
	assert.Equal(t, maxRetries, rules[0].Rule.MaxRetries)
}

func TestPolicyResolver_GetRules_SelectorWithEnvironment(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "staging",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "web",
		Slug:           "web",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Policy targets "production" only — should NOT match "staging"
	policy := &oapi.Policy{
		Id:        "policy-prod",
		Name:      "prod-only",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "environment.name == 'production'",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-prod",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry:     &oapi.RetryRule{MaxRetries: int32(3)},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	rules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)
	require.NoError(t, err)
	assert.Len(t, rules, 0, "Policy targeting 'production' should not match 'staging' environment")
}

func TestPolicyResolver_GetRules_DifferentRuleTypes(t *testing.T) {
	ctx := context.Background()
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)

	// Create system, environment, deployment, resource
	system := &oapi.System{Id: "system-1", Name: "test-system"}
	_ = st.Systems.Upsert(ctx, system)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "test-deployment",
		Slug:           "test-deployment",
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	resource := &oapi.Resource{
		Id:         "resource-1",
		Name:       "test-resource",
		Kind:       "server",
		Identifier: "resource-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create a policy with multiple rule types
	maxRetries := int32(3)
	policy := &oapi.Policy{
		Id:        "policy-1",
		Name:      "mixed-policy",
		Enabled:   true,
		Priority:  1,
		Metadata:  map[string]string{},
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
		Rules: []oapi.PolicyRule{
			{
				Id:        "rule-1",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				Retry: &oapi.RetryRule{
					MaxRetries: maxRetries,
				},
			},
			{
				Id:        "rule-2",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			{
				Id:        "rule-3",
				PolicyId:  "policy-1",
				CreatedAt: time.Now().Format(time.RFC3339),
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 60,
					RolloutType:       oapi.GradualRolloutRuleRolloutTypeLinear,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, policy)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// Test extracting retry rules
	retryRules, err := GetRules(ctx, st, releaseTarget, RetryRuleExtractor, nil)
	require.NoError(t, err)
	assert.Len(t, retryRules, 1, "Should extract 1 retry rule")

	// Test extracting approval rules
	approvalRules, err := GetRules(ctx, st, releaseTarget, AnyApprovalRuleExtractor, nil)
	require.NoError(t, err)
	assert.Len(t, approvalRules, 1, "Should extract 1 approval rule")
	assert.Equal(t, int32(2), approvalRules[0].Rule.MinApprovals)

	// Test extracting gradual rollout rules
	rolloutRules, err := GetRules(ctx, st, releaseTarget, GradualRolloutRuleExtractor, nil)
	require.NoError(t, err)
	assert.Len(t, rolloutRules, 1, "Should extract 1 gradual rollout rule")
	assert.Equal(t, int32(60), rolloutRules[0].Rule.TimeScaleInterval)
}
