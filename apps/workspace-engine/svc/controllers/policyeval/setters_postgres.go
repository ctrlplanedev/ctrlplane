package policyeval

import (
	"workspace-engine/pkg/store/policies"
	desiredpolicyeval "workspace-engine/svc/controllers/desiredrelease/policyeval"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct {
	upsertRuleEvaluationsSetter
}

func NewPostgresSetter() *PostgresSetter {
	return &PostgresSetter{
		upsertRuleEvaluationsSetter: policies.NewPostgresUpsertRuleEvaluations(
			desiredpolicyeval.RuleTypes(),
		),
	}
}
