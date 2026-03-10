package policyeval

import (
	"workspace-engine/pkg/store/policies"
)

type upsertRuleEvaluationsSetter = policies.UpsertRuleEvaluations

type Setter interface {
	upsertRuleEvaluationsSetter
}
