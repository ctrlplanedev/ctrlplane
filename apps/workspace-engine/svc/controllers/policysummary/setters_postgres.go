package policysummary

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/jackc/pgx/v5/pgtype"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct {
	queries *db.Queries
}

func NewPostgresSetter(queries *db.Queries) *PostgresSetter {
	return &PostgresSetter{queries: queries}
}

func (s *PostgresSetter) UpsertRuleSummaries(ctx context.Context, rows []RuleSummaryRow) error {
	if len(rows) == 0 {
		return nil
	}

	params := make([]db.UpsertPolicyRuleSummaryParams, len(rows))
	for i, row := range rows {
		eval := row.Evaluation

		var actionType pgtype.Text
		if eval.ActionType != nil {
			actionType = pgtype.Text{String: string(*eval.ActionType), Valid: true}
		}

		detailsMap := map[string]any{}
		if eval.Details != nil {
			detailsMap = eval.Details
		}

		var satisfiedAt pgtype.Timestamptz
		if eval.SatisfiedAt != nil {
			satisfiedAt = pgtype.Timestamptz{Time: *eval.SatisfiedAt, Valid: true}
		}

		var nextEvalAt pgtype.Timestamptz
		if eval.NextEvaluationTime != nil {
			nextEvalAt = pgtype.Timestamptz{Time: *eval.NextEvaluationTime, Valid: true}
		}

		params[i] = db.UpsertPolicyRuleSummaryParams{
			RuleID:           row.RuleID,
			EnvironmentID:    row.EnvironmentID,
			VersionID:        row.VersionID,
			Allowed:          eval.Allowed,
			ActionRequired:   eval.ActionRequired,
			ActionType:       actionType,
			Message:          eval.Message,
			Details:          detailsMap,
			SatisfiedAt:      satisfiedAt,
			NextEvaluationAt: nextEvalAt,
		}
	}

	results := s.queries.UpsertPolicyRuleSummary(ctx, params)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = fmt.Errorf("upsert rule summary %d: %w", i, err)
		}
	})
	return batchErr
}
