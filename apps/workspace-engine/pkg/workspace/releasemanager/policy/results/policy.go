package results

import (
	"workspace-engine/pkg/oapi"
)

type PolicyEvaluationResultOption func(*oapi.PolicyEvaluation)

func WithPolicy(policy *oapi.Policy) PolicyEvaluationResultOption {
	return func(per *oapi.PolicyEvaluation) {
		per.Policy = policy
	}
}

func WithRuleResults(ruleResults []oapi.RuleEvaluation) PolicyEvaluationResultOption {
	return func(per *oapi.PolicyEvaluation) {
		per.RuleResults = ruleResults
	}
}

func AddRuleResult(ruleResult oapi.RuleEvaluation) PolicyEvaluationResultOption {
	return func(per *oapi.PolicyEvaluation) {
		if per.RuleResults == nil {
			per.RuleResults = make([]oapi.RuleEvaluation, 0)
		}
		per.RuleResults = append(per.RuleResults, ruleResult)
	}
}

// NewPolicyEvaluation creates a new policy evaluation result with optional settings.
func NewPolicyEvaluation(opts ...PolicyEvaluationResultOption) *oapi.PolicyEvaluation {
	per := &oapi.PolicyEvaluation{
		RuleResults: make([]oapi.RuleEvaluation, 0),
	}
	for _, opt := range opts {
		opt(per)
	}
	return per
}
