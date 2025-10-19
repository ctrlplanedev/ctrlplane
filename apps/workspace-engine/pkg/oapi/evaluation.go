package oapi

func NewRuleEvaluation() *RuleEvaluation {
	return &RuleEvaluation{
		Allowed:        false,
		ActionRequired: false,
		ActionType:     nil,
		Message:        "",
		Details:        map[string]any{},
	}
}

func (r *RuleEvaluation) Allow() *RuleEvaluation {
	r.Allowed = true
	return r
}

func (r *RuleEvaluation) Deny() *RuleEvaluation {
	r.Allowed = false
	return r
}

func (r *RuleEvaluation) WithActionRequired(actionType RuleEvaluationActionType) *RuleEvaluation {
	r.ActionRequired = true
	r.ActionType = &actionType
	return r
}

func (r *RuleEvaluation) WithMessage(message string) *RuleEvaluation {
	r.Message = message
	return r
}

func (r *RuleEvaluation) WithDetail(key string, value any) *RuleEvaluation {
	if r.Details == nil {
		r.Details = map[string]any{}
	}
	r.Details[key] = value
	return r
}

func (r *RuleEvaluation) AsArray() []*RuleEvaluation {
	return []*RuleEvaluation{r}
}
