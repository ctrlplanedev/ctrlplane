package results

import (
	"fmt"
	"strings"
)

// NewPolicyEvaluationResult creates a new policy evaluation result.
func NewPolicyEvaluation(policyID, policyName string) *PolicyEvaluationResult {
	return &PolicyEvaluationResult{
		PolicyID:    policyID,
		PolicyName:  policyName,
		RuleResults: make([]*RuleEvaluationResult, 0),
		Overall:     true,
	}
}

// PolicyEvaluationResult aggregates results from all rules in a policy.
type PolicyEvaluationResult struct {
	// PolicyID identifies the policy that was evaluated
	PolicyID string

	// PolicyName is the human-readable name of the policy
	PolicyName string

	// RuleResults contains the result of each rule evaluation
	RuleResults []*RuleEvaluationResult

	// Overall indicates if all rules allow the deployment
	Overall bool

	// Summary provides a high-level explanation
	Summary string
}

// AddRuleResult adds a rule result and updates the overall status.
func (p *PolicyEvaluationResult) AddRuleResult(result *RuleEvaluationResult) {
	p.RuleResults = append(p.RuleResults, result)
	if !result.Allowed {
		p.Overall = false
	}
}

// GenerateSummary creates a human-readable summary of the evaluation.
func (p *PolicyEvaluationResult) GenerateSummary() {
	if p.Overall {
		p.Summary = "All policy rules passed"
		return
	}

	var deniedRules []string
	var pendingRules []string

	for _, result := range p.RuleResults {
		if !result.Allowed {
			if result.RequiresAction {
				pendingRules = append(pendingRules, fmt.Sprintf("%s (%s)", result.RuleType, result.Reason))
			} else {
				deniedRules = append(deniedRules, fmt.Sprintf("%s (%s)", result.RuleType, result.Reason))
			}
		}
	}

	var parts []string
	if len(deniedRules) > 0 {
		parts = append(parts, fmt.Sprintf("Denied by: %s", strings.Join(deniedRules, ", ")))
	}
	if len(pendingRules) > 0 {
		parts = append(parts, fmt.Sprintf("Pending: %s", strings.Join(pendingRules, ", ")))
	}

	p.Summary = strings.Join(parts, "; ")
}

// HasDenials returns true if any rule explicitly denied the deployment.
func (p *PolicyEvaluationResult) HasDenials() bool {
	for _, result := range p.RuleResults {
		if !result.Allowed && !result.RequiresAction {
			return true
		}
	}
	return false
}

// HasPendingActions returns true if any rule requires action before proceeding.
func (p *PolicyEvaluationResult) HasPendingActions() bool {
	for _, result := range p.RuleResults {
		if result.RequiresAction {
			return true
		}
	}
	return false
}

// GetPendingActions returns all results that require action.
func (p *PolicyEvaluationResult) GetPendingActions() []*RuleEvaluationResult {
	pending := make([]*RuleEvaluationResult, 0)
	for _, result := range p.RuleResults {
		if result.RequiresAction {
			pending = append(pending, result)
		}
	}
	return pending
}

