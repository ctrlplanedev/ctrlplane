package oapi

func (d *DeployDecision) CanDeploy() bool {
	// Can't deploy if there are no policy results (need at least empty evaluations)
	if d.PolicyResults == nil {
		return true
	}

	// Check if any policy has denials or pending actions
	for _, policyResult := range d.PolicyResults {
		if policyResult.HasDenials() || policyResult.HasPendingActions() {
			return false
		}
	}

	return true
}

func (d *DeployDecision) IsPending() bool {
	// Pending means has pending actions but not blocked
	return !d.IsBlocked() && len(d.GetPendingActions()) > 0
}

func (d *DeployDecision) IsBlocked() bool {
	for _, policyResult := range d.PolicyResults {
		if policyResult.HasDenials() {
			return true
		}
	}
	return false
}

func (d *DeployDecision) NeedsApproval() bool {
	approvalActions := d.GetApprovalActions()
	return len(approvalActions) > 0
}

func (d *DeployDecision) NeedsWait() bool {
	waitActions := d.GetWaitActions()
	return len(waitActions) > 0
}

func (d *DeployDecision) GetPendingActions() []*RuleEvaluation {
	pending := make([]*RuleEvaluation, 0)
	for _, policyResult := range d.PolicyResults {
		pending = append(pending, policyResult.GetPendingActions()...)
	}
	return pending
}

func (d *DeployDecision) GetApprovalActions() []*RuleEvaluation {
	actions := make([]*RuleEvaluation, 0)
	for _, action := range d.GetPendingActions() {
		if action.ActionType != nil && *action.ActionType == "approval" {
			actions = append(actions, action)
		}
	}
	return actions
}

func (d *DeployDecision) GetWaitActions() []*RuleEvaluation {
	actions := make([]*RuleEvaluation, 0)
	for _, action := range d.GetPendingActions() {
		if action.ActionType != nil && *action.ActionType == "wait" {
			actions = append(actions, action)
		}
	}
	return actions
}

func (d *PolicyEvaluation) HasDenials() bool {
	for _, ruleResult := range d.RuleResults {
		if !ruleResult.Allowed {
			return true
		}
	}
	return false
}

func (d *PolicyEvaluation) GetPendingActions() []*RuleEvaluation {
	pending := make([]*RuleEvaluation, 0)
	for _, ruleResult := range d.RuleResults {
		if ruleResult.ActionRequired {
			pending = append(pending, &ruleResult)
		}
	}
	return pending
}

func (d *PolicyEvaluation) Allowed() bool {
	for _, ruleResult := range d.RuleResults {
		if !ruleResult.Allowed {
			return false
		}
	}
	return true
}

func (d *PolicyEvaluation) AddRuleResult(ruleResult RuleEvaluation) {
	d.RuleResults = append(d.RuleResults, ruleResult)
}

func (d *PolicyEvaluation) HasPendingActions() bool {
	for _, ruleResult := range d.RuleResults {
		if ruleResult.ActionRequired {
			return true
		}
	}
	return false
}
