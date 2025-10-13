package results

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewPolicyEvaluation(t *testing.T) {
	tests := []struct {
		name       string
		policyID   string
		policyName string
	}{
		{
			name:       "creates policy evaluation with basic info",
			policyID:   "policy-123",
			policyName: "Test Policy",
		},
		{
			name:       "handles empty policy name",
			policyID:   "policy-456",
			policyName: "",
		},
		{
			name:       "handles empty policy ID",
			policyID:   "",
			policyName: "Empty ID Policy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NewPolicyEvaluation(tt.policyID, tt.policyName)

			assert.NotNil(t, result)
			assert.Equal(t, tt.policyID, result.PolicyID)
			assert.Equal(t, tt.policyName, result.PolicyName)
			assert.NotNil(t, result.RuleResults)
			assert.Empty(t, result.RuleResults)
			assert.True(t, result.Overall, "Overall should be true by default")
			assert.Empty(t, result.Summary)
		})
	}
}

func TestPolicyEvaluationResult_AddRuleResult(t *testing.T) {
	tests := []struct {
		name            string
		ruleResults     []*RuleEvaluationResult
		expectedOverall bool
	}{
		{
			name: "all rules allowed keeps overall true",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("rule 1 passed"),
				NewAllowedResult("rule 2 passed"),
				NewAllowedResult("rule 3 passed"),
			},
			expectedOverall: true,
		},
		{
			name: "one denied rule sets overall to false",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("rule 1 passed"),
				NewDeniedResult("rule 2 failed"),
				NewAllowedResult("rule 3 passed"),
			},
			expectedOverall: false,
		},
		{
			name: "one pending rule sets overall to false",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("rule 1 passed"),
				NewPendingResult("approval", "approval", "waiting for approval"),
				NewAllowedResult("rule 3 passed"),
			},
			expectedOverall: false,
		},
		{
			name: "multiple denied rules keeps overall false",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("rule 1 failed"),
				NewDeniedResult("rule 2 failed"),
				NewDeniedResult("rule 3 failed"),
			},
			expectedOverall: false,
		},
		{
			name:            "no rules keeps overall true",
			ruleResults:     []*RuleEvaluationResult{},
			expectedOverall: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewPolicyEvaluation("test-policy", "Test Policy")

			for _, ruleResult := range tt.ruleResults {
				policy.AddRuleResult(ruleResult)
			}

			assert.Equal(t, tt.expectedOverall, policy.Overall)
			assert.Equal(t, len(tt.ruleResults), len(policy.RuleResults))
		})
	}
}

func TestPolicyEvaluationResult_GenerateSummary(t *testing.T) {
	tests := []struct {
		name            string
		ruleResults     []*RuleEvaluationResult
		expectedSummary string
	}{
		{
			name: "all rules pass",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("rule 1 passed"),
				NewAllowedResult("rule 2 passed"),
			},
			expectedSummary: "All policy rules passed",
		},
		{
			name: "only denied rules",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("concurrency limit exceeded"),
				NewDeniedResult("invalid time window"),
			},
			expectedSummary: "Denied by: concurrency limit exceeded, invalid time window",
		},
		{
			name: "only pending rules",
			ruleResults: []*RuleEvaluationResult{
				NewPendingResult("approval", "approval", "waiting for manager approval"),
				NewPendingResult("approval", "approval", "waiting for security review"),
			},
			expectedSummary: "Pending: waiting for manager approval, waiting for security review",
		},
		{
			name: "mixed denied and pending rules",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("concurrency limit exceeded"),
				NewPendingResult("approval", "approval", "waiting for approval"),
				NewAllowedResult("time window check passed"),
			},
			expectedSummary: "Denied by: concurrency limit exceeded; Pending: waiting for approval",
		},
		{
			name: "denied and pending with multiple of each",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("reason 1"),
				NewDeniedResult("reason 2"),
				NewPendingResult("approval", "approval", "pending 1"),
				NewPendingResult("approval", "approval", "pending 2"),
			},
			expectedSummary: "Denied by: reason 1, reason 2; Pending: pending 1, pending 2",
		},
		{
			name:            "no rules",
			ruleResults:     []*RuleEvaluationResult{},
			expectedSummary: "All policy rules passed",
		},
		{
			name: "allowed rules only",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed 1"),
				NewAllowedResult("allowed 2"),
				NewAllowedResult("allowed 3"),
			},
			expectedSummary: "All policy rules passed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewPolicyEvaluation("test-policy", "Test Policy")

			for _, ruleResult := range tt.ruleResults {
				policy.AddRuleResult(ruleResult)
			}

			policy.GenerateSummary()

			assert.Equal(t, tt.expectedSummary, policy.Summary)
		})
	}
}

func TestPolicyEvaluationResult_HasDenials(t *testing.T) {
	tests := []struct {
		name         string
		ruleResults  []*RuleEvaluationResult
		expectDenial bool
	}{
		{
			name: "has denied rule returns true",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed"),
				NewDeniedResult("denied"),
			},
			expectDenial: true,
		},
		{
			name: "only pending rules returns false",
			ruleResults: []*RuleEvaluationResult{
				NewPendingResult("approval", "approval", "pending"),
				NewPendingResult("approval", "approval", "pending 2"),
			},
			expectDenial: false,
		},
		{
			name: "only allowed rules returns false",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed 1"),
				NewAllowedResult("allowed 2"),
			},
			expectDenial: false,
		},
		{
			name: "mixed denied and pending returns true",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("denied"),
				NewPendingResult("approval", "approval", "pending"),
			},
			expectDenial: true,
		},
		{
			name:         "no rules returns false",
			ruleResults:  []*RuleEvaluationResult{},
			expectDenial: false,
		},
		{
			name: "multiple denied rules returns true",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("denied 1"),
				NewDeniedResult("denied 2"),
				NewDeniedResult("denied 3"),
			},
			expectDenial: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewPolicyEvaluation("test-policy", "Test Policy")

			for _, ruleResult := range tt.ruleResults {
				policy.AddRuleResult(ruleResult)
			}

			result := policy.HasDenials()
			assert.Equal(t, tt.expectDenial, result)
		})
	}
}

func TestPolicyEvaluationResult_HasPendingActions(t *testing.T) {
	tests := []struct {
		name          string
		ruleResults   []*RuleEvaluationResult
		expectPending bool
	}{
		{
			name: "has pending action returns true",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed"),
				NewPendingResult("approval", "approval", "pending"),
			},
			expectPending: true,
		},
		{
			name: "only denied rules returns false",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("denied 1"),
				NewDeniedResult("denied 2"),
			},
			expectPending: false,
		},
		{
			name: "only allowed rules returns false",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed 1"),
				NewAllowedResult("allowed 2"),
			},
			expectPending: false,
		},
		{
			name: "mixed denied and pending returns true",
			ruleResults: []*RuleEvaluationResult{
				NewDeniedResult("denied"),
				NewPendingResult("approval", "approval", "pending"),
			},
			expectPending: true,
		},
		{
			name:          "no rules returns false",
			ruleResults:   []*RuleEvaluationResult{},
			expectPending: false,
		},
		{
			name: "multiple pending actions returns true",
			ruleResults: []*RuleEvaluationResult{
				NewPendingResult("approval", "approval", "pending 1"),
				NewPendingResult("approval", "approval", "pending 2"),
				NewPendingResult("approval", "approval", "pending 3"),
			},
			expectPending: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewPolicyEvaluation("test-policy", "Test Policy")

			for _, ruleResult := range tt.ruleResults {
				policy.AddRuleResult(ruleResult)
			}

			result := policy.HasPendingActions()
			assert.Equal(t, tt.expectPending, result)
		})
	}
}

func TestPolicyEvaluationResult_GetPendingActions(t *testing.T) {
	tests := []struct {
		name          string
		ruleResults   []*RuleEvaluationResult
		expectedCount int
	}{
		{
			name: "returns only pending actions",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed"),
				NewPendingResult("approval", "approval", "pending 1"),
				NewDeniedResult("denied"),
				NewPendingResult("approval", "approval", "pending 2"),
			},
			expectedCount: 2,
		},
		{
			name: "returns empty slice when no pending actions",
			ruleResults: []*RuleEvaluationResult{
				NewAllowedResult("allowed"),
				NewDeniedResult("denied"),
			},
			expectedCount: 0,
		},
		{
			name: "returns all when all are pending",
			ruleResults: []*RuleEvaluationResult{
				NewPendingResult("approval", "approval", "pending 1"),
				NewPendingResult("approval", "approval", "pending 2"),
				NewPendingResult("approval", "approval", "pending 3"),
			},
			expectedCount: 3,
		},
		{
			name:          "returns empty slice when no rules",
			ruleResults:   []*RuleEvaluationResult{},
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewPolicyEvaluation("test-policy", "Test Policy")

			for _, ruleResult := range tt.ruleResults {
				policy.AddRuleResult(ruleResult)
			}

			pending := policy.GetPendingActions()

			assert.NotNil(t, pending)
			assert.Equal(t, tt.expectedCount, len(pending))

			// Verify all returned results require action
			for _, result := range pending {
				assert.True(t, result.RequiresAction)
			}
		})
	}
}

func TestPolicyEvaluationResult_Integration(t *testing.T) {
	t.Run("complete workflow with multiple rule types", func(t *testing.T) {
		policy := NewPolicyEvaluation("prod-policy-123", "Production Deployment Policy")

		// Add various rule results
		policy.AddRuleResult(NewAllowedResult("time window check passed"))
		policy.AddRuleResult(NewPendingResult("approval", "approval", "waiting for manager approval"))
		policy.AddRuleResult(NewDeniedResult("concurrency limit exceeded"))
		policy.AddRuleResult(NewAllowedResult("resource quota check passed"))

		// Test overall status
		assert.False(t, policy.Overall)

		// Test denials
		assert.True(t, policy.HasDenials())

		// Test pending actions
		assert.True(t, policy.HasPendingActions())
		pending := policy.GetPendingActions()
		assert.Equal(t, 1, len(pending))
		assert.Equal(t, "waiting for manager approval", pending[0].Reason)

		// Generate and verify summary
		policy.GenerateSummary()
		assert.Contains(t, policy.Summary, "Denied by: concurrency limit exceeded")
		assert.Contains(t, policy.Summary, "Pending: waiting for manager approval")

		// Verify all rules are present
		assert.Equal(t, 4, len(policy.RuleResults))
	})

	t.Run("successful policy evaluation", func(t *testing.T) {
		policy := NewPolicyEvaluation("dev-policy-456", "Development Deployment Policy")

		// Add only allowed results
		policy.AddRuleResult(NewAllowedResult("all checks passed"))
		policy.AddRuleResult(NewAllowedResult("no conflicts detected"))
		policy.AddRuleResult(NewAllowedResult("resource limits ok"))

		// Test overall status
		assert.True(t, policy.Overall)

		// Test no denials or pending actions
		assert.False(t, policy.HasDenials())
		assert.False(t, policy.HasPendingActions())
		assert.Empty(t, policy.GetPendingActions())

		// Generate and verify summary
		policy.GenerateSummary()
		assert.Equal(t, "All policy rules passed", policy.Summary)
	})

	t.Run("policy with only pending actions", func(t *testing.T) {
		policy := NewPolicyEvaluation("staging-policy-789", "Staging Deployment Policy")

		// Add multiple pending actions
		policy.AddRuleResult(NewPendingResult("approval", "approval", "security team approval required"))
		policy.AddRuleResult(NewPendingResult("approval", "approval", "ops team approval required"))

		// Test overall status
		assert.False(t, policy.Overall)

		// Test no denials but has pending
		assert.False(t, policy.HasDenials())
		assert.True(t, policy.HasPendingActions())
		pending := policy.GetPendingActions()
		assert.Equal(t, 2, len(pending))

		// Generate and verify summary
		policy.GenerateSummary()
		assert.Equal(t, "Pending: security team approval required, ops team approval required", policy.Summary)
	})
}
