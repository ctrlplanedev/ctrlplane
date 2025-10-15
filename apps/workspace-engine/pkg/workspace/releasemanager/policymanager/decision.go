package policymanager

import (
	"time"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
)

// DeployDecision represents the final decision about whether a deployment can proceed.
// It provides detailed information about policy evaluation results and required actions.
type DeployDecision struct {
	PolicyResults []*results.PolicyEvaluationResult
	EvaluatedAt   time.Time
}

func (d *DeployDecision) GetPendingActions() []*results.RuleEvaluationResult {
	if d.PolicyResults == nil {
		return make([]*results.RuleEvaluationResult, 0)
	}

	pending := make([]*results.RuleEvaluationResult, 0)
	for _, policyResult := range d.PolicyResults {
		pending = append(pending, policyResult.GetPendingActions()...)
	}
	return pending
}

func (d *DeployDecision) CanDeploy() bool {
	return !d.IsBlocked() && len(d.GetPendingActions()) == 0
}

func (d *DeployDecision) IsPending() bool {
	return len(d.GetPendingActions()) > 0 && !d.IsBlocked()
}

func (d *DeployDecision) IsBlocked() bool {
	if d.PolicyResults == nil {
		return false
	}

	for _, policyResult := range d.PolicyResults {
		if policyResult.HasDenials() {
			return true
		}
	}
	return false
}

// NeedsApproval returns true if the deployment requires any approval.
func (d *DeployDecision) NeedsApproval() bool {
	for _, action := range d.GetPendingActions() {
		if action.ActionType == "approval" {
			return true
		}
	}
	return false
}

// NeedsWait returns true if the deployment must wait for something (e.g., concurrency slot).
func (d *DeployDecision) NeedsWait() bool {
	for _, action := range d.GetPendingActions() {
		if action.ActionType == "wait" {
			return true
		}
	}
	return false
}

// GetApprovalActions returns all pending approval actions.
func (d *DeployDecision) GetApprovalActions() []*results.RuleEvaluationResult {
	approvals := make([]*results.RuleEvaluationResult, 0)
	for _, action := range d.GetPendingActions() {
		if action.ActionType == "approval" {
			approvals = append(approvals, action)
		}
	}
	return approvals
}

// GetWaitActions returns all pending wait actions.
func (d *DeployDecision) GetWaitActions() []*results.RuleEvaluationResult {
	waits := make([]*results.RuleEvaluationResult, 0)
	for _, action := range d.GetPendingActions() {
		if action.ActionType == "wait" {
			waits = append(waits, action)
		}
	}
	return waits
}
