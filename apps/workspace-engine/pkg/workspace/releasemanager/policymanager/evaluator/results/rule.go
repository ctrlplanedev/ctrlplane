package results

// EvaluationResult represents the outcome of evaluating a policy rule.
type RuleEvaluationResult struct {
	// RuleID identifies which rule was evaluated
	RuleID string

	// RuleType describes the type of rule (e.g., "deny_window", "user_approval")
	RuleType string

	// Allowed indicates whether the rule permits the deployment
	Allowed bool

	// Reason provides a human-readable explanation for the result
	Reason string

	// Details contains structured information about the evaluation
	// (e.g., approval status, concurrent deployments count)
	Details map[string]any

	// RequiresAction indicates if the rule needs external action before proceeding
	// (e.g., approval rules require someone to approve)
	RequiresAction bool

	// ActionType describes what action is needed (e.g., "approval", "wait")
	ActionType string
}

// WithDetail adds a detail to the result and returns the result for chaining.
func (r *RuleEvaluationResult) WithDetail(key string, value interface{}) *RuleEvaluationResult {
	if r.Details == nil {
		r.Details = make(map[string]interface{})
	}
	r.Details[key] = value
	return r
}


// NewPendingResult creates a result indicating the rule requires action before proceeding.
func NewPendingResult(ruleID, ruleType, actionType, reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		RuleID:         ruleID,
		RuleType:       ruleType,
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]interface{}),
		RequiresAction: true,
		ActionType:     actionType,
	}
}

// NewDeniedResult creates a result indicating the rule denies the deployment.
func NewDeniedResult(ruleID, ruleType, reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		RuleID:         ruleID,
		RuleType:       ruleType,
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]interface{}),
		RequiresAction: false,
	}
}

// NewAllowedResult creates a result indicating the rule allows the deployment.
func NewAllowedResult(ruleID, ruleType, reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		RuleID:         ruleID,
		RuleType:       ruleType,
		Allowed:        true,
		Reason:         reason,
		Details:        make(map[string]any),
		RequiresAction: false,
	}
}
