package policy

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"

	"github.com/stretchr/testify/assert"
)

func TestPolicyEvaluation_GetPendingActions(t *testing.T) {
	tests := []struct {
		name   string
		policy oapi.PolicyEvaluation
		want   int
	}{
		{
			name: "no pending actions",
			policy: oapi.PolicyEvaluation{
				Policy: &oapi.Policy{
					Id:   "policy-1",
					Name: "Test Policy",
				},
				RuleResults: []oapi.RuleEvaluation{
					*results.NewAllowedResult("rule passed"),
				},
			},
			want: 0,
		},
		{
			name: "single pending action",
			policy: oapi.PolicyEvaluation{
				Policy: &oapi.Policy{
					Id:   "policy-1",
					Name: "Test Policy",
				},
				RuleResults: []oapi.RuleEvaluation{
					*results.NewPendingResult("approval", "needs approval"),
				},
			},
			want: 1,
		},
		{
			name: "multiple pending actions",
			policy: oapi.PolicyEvaluation{
				Policy: &oapi.Policy{
					Id:   "policy-1",
					Name: "Test Policy",
				},
				RuleResults: []oapi.RuleEvaluation{
					*results.NewPendingResult("approval", "needs approval"),
					*results.NewAllowedResult("rule passed"),
					*results.NewPendingResult("wait", "waiting for slot"),
				},
			},
			want: 2,
		},
		{
			name: "policy with denied and pending results",
			policy: oapi.PolicyEvaluation{
				Policy: &oapi.Policy{
					Id:   "policy-1",
					Name: "Test Policy",
				},
				RuleResults: []oapi.RuleEvaluation{
					*results.NewDeniedResult("explicitly denied"),
					*results.NewPendingResult("approval", "needs approval"),
				},
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.policy.GetPendingActions()
			assert.Equal(t, tt.want, len(got))
		})
	}
}

func TestDeployDecision_CanDeploy(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     bool
	}{
		{
			name: "no pending actions - can deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "has pending approval - cannot deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "has pending wait - cannot deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "waiting for slot"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "nil policy results - can deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: true,
		},
		{
			name: "empty policy results - can deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{},
			},
			want: true,
		},
		{
			name: "has denial - cannot deploy",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewDeniedResult("explicitly denied"),
						},
					},
				},
			},
			want: false, // Denied deployments cannot proceed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.CanDeploy()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDeployDecision_IsPending(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     bool
	}{
		{
			name: "has pending actions and not blocked - is pending",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "has pending actions but also blocked - not pending",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
							*results.NewDeniedResult("explicitly denied"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "no pending actions - not pending",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "blocked but no pending actions - not pending",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewDeniedResult("explicitly denied"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "nil policy results - not pending",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.IsPending()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDeployDecision_IsBlocked(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     bool
	}{
		{
			name: "has denial - is blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewDeniedResult("explicitly denied"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "no denials - not blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "pending actions but no denials - not blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "multiple policies with one denial - is blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy 1",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
					{
						Policy: &oapi.Policy{
							Id:   "policy-2",
							Name: "Test Policy 2",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewDeniedResult("blocked"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "nil policy results - not blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: false,
		},
		{
			name: "empty policy results - not blocked",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.IsBlocked()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDeployDecision_NeedsApproval(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     bool
	}{
		{
			name: "has approval action - needs approval",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "only wait actions - does not need approval",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "waiting for slot"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "mix of approval and wait actions - needs approval",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "waiting for slot"),
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "no pending actions - does not need approval",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "nil policy results - does not need approval",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.NeedsApproval()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDeployDecision_NeedsWait(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     bool
	}{
		{
			name: "has wait action - needs wait",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "waiting for slot"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "only approval actions - does not need wait",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "mix of approval and wait actions - needs wait",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "needs approval"),
							*results.NewPendingResult("wait", "waiting for slot"),
						},
					},
				},
			},
			want: true,
		},
		{
			name: "no pending actions - does not need wait",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: false,
		},
		{
			name: "nil policy results - does not need wait",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.NeedsWait()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDeployDecision_GetApprovalActions(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     int
	}{
		{
			name: "only approval actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "approval 1"),
							*results.NewPendingResult("approval", "approval 2"),
						},
					},
				},
			},
			want: 2,
		},
		{
			name: "only wait actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "wait 1"),
							*results.NewPendingResult("wait", "wait 2"),
						},
					},
				},
			},
			want: 0,
		},
		{
			name: "mix of approval and wait actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "approval 1"),
							*results.NewPendingResult("wait", "wait 1"),
							*results.NewPendingResult("approval", "approval 2"),
						},
					},
				},
			},
			want: 2,
		},
		{
			name: "no pending actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: 0,
		},
		{
			name: "nil policy results",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: 0,
		},
		{
			name: "multiple policies with approval actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy 1",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "approval 1"),
						},
					},
					{
						Policy: &oapi.Policy{
							Id:   "policy-2",
							Name: "Test Policy 2",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "approval 2"),
							*results.NewPendingResult("wait", "wait 1"),
						},
					},
				},
			},
			want: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.GetApprovalActions()
			assert.Equal(t, tt.want, len(got))
			// Verify all returned actions are approval type
			for _, action := range got {
				actionTypeStr := string(*action.ActionType)
				assert.Equal(t, string(results.ActionTypeApproval), actionTypeStr)
			}
		})
	}
}

func TestDeployDecision_GetWaitActions(t *testing.T) {
	tests := []struct {
		name     string
		decision *oapi.DeployDecision
		want     int
	}{
		{
			name: "only wait actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "wait 1"),
							*results.NewPendingResult("wait", "wait 2"),
						},
					},
				},
			},
			want: 2,
		},
		{
			name: "only approval actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("approval", "approval 1"),
							*results.NewPendingResult("approval", "approval 2"),
						},
					},
				},
			},
			want: 0,
		},
		{
			name: "mix of approval and wait actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "wait 1"),
							*results.NewPendingResult("approval", "approval 1"),
							*results.NewPendingResult("wait", "wait 2"),
						},
					},
				},
			},
			want: 2,
		},
		{
			name: "no pending actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewAllowedResult("all good"),
						},
					},
				},
			},
			want: 0,
		},
		{
			name: "nil policy results",
			decision: &oapi.DeployDecision{
				PolicyResults: nil,
			},
			want: 0,
		},
		{
			name: "multiple policies with wait actions",
			decision: &oapi.DeployDecision{
				PolicyResults: []oapi.PolicyEvaluation{
					{
						Policy: &oapi.Policy{
							Id:   "policy-1",
							Name: "Test Policy 1",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "wait 1"),
						},
					},
					{
						Policy: &oapi.Policy{
							Id:   "policy-2",
							Name: "Test Policy 2",
						},
						RuleResults: []oapi.RuleEvaluation{
							*results.NewPendingResult("wait", "wait 2"),
							*results.NewPendingResult("approval", "approval 1"),
						},
					},
				},
			},
			want: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.decision.GetWaitActions()
			assert.Equal(t, tt.want, len(got))
			// Verify all returned actions are wait type
			for _, action := range got {
				actionTypeStr := string(*action.ActionType)
				assert.Equal(t, string(results.ActionTypeWait), actionTypeStr)
			}
		})
	}
}

func TestDeployDecision_EvaluatedAt(t *testing.T) {
	// Test that EvaluatedAt field is properly set and accessible
	now := time.Now()
	decision := &oapi.DeployDecision{
		PolicyResults: []oapi.PolicyEvaluation{},
	}

	// Note: EvaluatedAt field would need to be added to oapi.DeployDecision if not already present
	// This test is a placeholder and may need to be updated when the field is available
	_ = now
	_ = decision
	// assert.Equal(t, now, decision.EvaluatedAt)
}

func TestDeployDecision_ComplexScenarios(t *testing.T) {
	t.Run("complex scenario - multiple policies with various states", func(t *testing.T) {
		decision := &oapi.DeployDecision{
			PolicyResults: []oapi.PolicyEvaluation{
				{
					Policy: &oapi.Policy{
						Id:   "policy-1",
						Name: "Approval Policy",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewPendingResult("approval", "needs manager approval"),
						*results.NewAllowedResult("passed rule"),
					},
				},
				{
					Policy: &oapi.Policy{
						Id:   "policy-2",
						Name: "Concurrency Policy",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewPendingResult("wait", "waiting for concurrency slot"),
					},
				},
				{
					Policy: &oapi.Policy{
						Id:   "policy-3",
						Name: "Basic Rules",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewAllowedResult("all checks passed"),
					},
				},
			},
		}

		// Verify complex state
		assert.False(t, decision.CanDeploy(), "should not be able to deploy with pending actions")
		assert.True(t, decision.IsPending(), "should be in pending state")
		assert.False(t, decision.IsBlocked(), "should not be blocked")
		assert.True(t, decision.NeedsApproval(), "should need approval")
		assert.True(t, decision.NeedsWait(), "should need to wait")

		pendingActions := decision.GetPendingActions()
		assert.Equal(t, 2, len(pendingActions), "should have 2 pending actions")

		approvalActions := decision.GetApprovalActions()
		assert.Equal(t, 1, len(approvalActions), "should have 1 approval action")

		waitActions := decision.GetWaitActions()
		assert.Equal(t, 1, len(waitActions), "should have 1 wait action")
	})

	t.Run("complex scenario - blocked with pending actions", func(t *testing.T) {
		decision := &oapi.DeployDecision{
			PolicyResults: []oapi.PolicyEvaluation{
				{
					Policy: &oapi.Policy{
						Id:   "policy-1",
						Name: "Security Policy",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewDeniedResult("security check failed"),
						*results.NewPendingResult("approval", "needs approval"),
					},
				},
			},
		}

		// Verify blocked state takes precedence
		assert.False(t, decision.CanDeploy(), "should not be able to deploy when blocked")
		assert.False(t, decision.IsPending(), "should not be pending when blocked")
		assert.True(t, decision.IsBlocked(), "should be blocked")
		assert.True(t, decision.NeedsApproval(), "should still report needing approval")

		pendingActions := decision.GetPendingActions()
		assert.Equal(t, 1, len(pendingActions), "should still have pending actions")
	})

	t.Run("complex scenario - all policies pass", func(t *testing.T) {
		decision := &oapi.DeployDecision{
			PolicyResults: []oapi.PolicyEvaluation{
				{
					Policy: &oapi.Policy{
						Id:   "policy-1",
						Name: "Policy 1",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewAllowedResult("rule 1 passed"),
						*results.NewAllowedResult("rule 2 passed"),
					},
				},
				{
					Policy: &oapi.Policy{
						Id:   "policy-2",
						Name: "Policy 2",
					},
					RuleResults: []oapi.RuleEvaluation{
						*results.NewAllowedResult("rule 3 passed"),
					},
				},
			},
		}

		// Verify ready to deploy state
		assert.True(t, decision.CanDeploy(), "should be able to deploy when all pass")
		assert.False(t, decision.IsPending(), "should not be pending")
		assert.False(t, decision.IsBlocked(), "should not be blocked")
		assert.False(t, decision.NeedsApproval(), "should not need approval")
		assert.False(t, decision.NeedsWait(), "should not need to wait")

		pendingActions := decision.GetPendingActions()
		assert.Equal(t, 0, len(pendingActions), "should have no pending actions")
	})
}
