package policysummary

import (
	"context"
	"fmt"
)

type PostgresSetter struct{}

var _ Setter = (*PostgresSetter)(nil)

func (s *PostgresSetter) UpsertRuleSummaries(ctx context.Context, rows []RuleSummaryRow) error {
	// TODO: batch upsert into policy_rule_summary table
	// ON CONFLICT (rule_id, deployment_id, environment_id, version_id) DO UPDATE
	// SET allowed = EXCLUDED.allowed, message = EXCLUDED.message, ...
	if len(rows) == 0 {
		return nil
	}
	return fmt.Errorf("not implemented")
}
