package oapi

func (d *DeployDecision) CanDeploy() bool {
	if len(d.PolicyResults) == 0 {
		return false
	}

	for _, ruleResult := range d.PolicyResults {
		if ruleResult.HasDenials() {
			return true
		}
	}

	return false
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
