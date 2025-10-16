package results

import "workspace-engine/pkg/oapi"

type ActionType string

const (
	ActionTypeApproval ActionType = "approval"
	ActionTypeWait     ActionType = "wait"
)

func NewResult() *oapi.RuleEvaluation {
	return oapi.NewRuleEvaluation()
}

// NewPendingResult creates a result indicating the rule requires action before proceeding.
func NewPendingResult(actionType ActionType, reason string) *oapi.RuleEvaluation {
	return NewResult().
		WithActionRequired(oapi.RuleEvaluationActionType(actionType)).
		WithMessage(reason)
}

// NewDeniedResult creates a result indicating the rule denies the deployment.
func NewDeniedResult(reason string) *oapi.RuleEvaluation {
	return NewResult().WithMessage(reason)
}

// NewAllowedResult creates a result indicating the rule allows the deployment.
func NewAllowedResult(reason string) *oapi.RuleEvaluation {
	return NewResult().
		Allow().
		WithMessage(reason)
}
