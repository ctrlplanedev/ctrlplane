package results

type ActionType string

const (
	ActionTypeApproval ActionType = "approval"
	ActionTypeWait     ActionType = "wait"
)

func NewResult() *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Details:        make(map[string]any),
	}
}

// EvaluationResult represents the outcome of evaluating a policy rule.
type RuleEvaluationResult struct {
	// Allowed indicates whether the rule permits the action
	Allowed bool

	// Reason provides a human-readable explanation for the result
	Reason string

	// Details contains structured information about the evaluation
	// (e.g., approval status, concurrent deployments count)
	Details map[string]any

	// ActionRequired indicates if the rule needs external action before proceeding
	// (e.g., approval rules require someone to approve)
	ActionRequired bool

	// ActionType describes what action is needed (e.g., "approval", "wait")
	ActionType ActionType
}

func (r *RuleEvaluationResult) Allow() *RuleEvaluationResult {
	r.Allowed = true
	return r
}

func (r *RuleEvaluationResult) WithReason(reason string) *RuleEvaluationResult {
	r.Reason = reason
	return r
}

func (r *RuleEvaluationResult) WithActionRequired(actionType ActionType) *RuleEvaluationResult {
	r.ActionRequired = true
	r.ActionType = actionType
	return r
}

// WithDetail adds a detail to the result and returns the result for chaining.
func (r *RuleEvaluationResult) WithDetail(key string, value any) *RuleEvaluationResult {
	if r.Details == nil {
		r.Details = make(map[string]any)
	}
	r.Details[key] = value
	return r
}

// NewPendingResult creates a result indicating the rule requires action before proceeding.
func NewPendingResult(actionType ActionType, reason string) *RuleEvaluationResult {
	return NewResult().
		WithActionRequired(actionType).
		WithReason(reason)
}

// NewDeniedResult creates a result indicating the rule denies the deployment.
func NewDeniedResult(reason string) *RuleEvaluationResult {
	return NewResult().WithReason(reason)
}

// NewAllowedResult creates a result indicating the rule allows the deployment.
func NewAllowedResult(reason string) *RuleEvaluationResult {
	return NewResult().
		Allow().
		WithReason(reason)
}
