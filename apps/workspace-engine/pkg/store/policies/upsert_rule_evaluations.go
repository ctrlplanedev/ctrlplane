package policies

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type UpsertRuleEvaluations interface {
	UpsertRuleEvaluations(ctx context.Context, evaluations []RuleEvaluationParams) error
}

type RuleEvaluationParams struct {
	RuleID        string
	EnvironmentID string
	VersionID     string
	ResourceID    string
	Evaluation    *oapi.RuleEvaluation
}

var _ UpsertRuleEvaluations = (*PostgresUpsertRuleEvaluations)(nil)

type PostgresUpsertRuleEvaluations struct{}

func (p *PostgresUpsertRuleEvaluations) UpsertRuleEvaluations(ctx context.Context, evaluations []RuleEvaluationParams) error {
	ctx, span := tracer.Start(ctx, "Store.UpsertRuleEvaluations")
	defer span.End()

	if len(evaluations) == 0 {
		return nil
	}

	batchParams := make([]db.BatchUpsertPolicyRuleEvaluationParams, 0, len(evaluations))
	for _, e := range evaluations {
		batchParams = append(batchParams, toDBParams(e))
	}

	results := db.GetQueries(ctx).BatchUpsertPolicyRuleEvaluation(ctx, batchParams)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = fmt.Errorf("batch upsert policy rule evaluation %d: %w", i, err)
		}
	})
	return batchErr
}

func toDBParams(e RuleEvaluationParams) db.BatchUpsertPolicyRuleEvaluationParams {
	var actionType pgtype.Text
	if e.Evaluation.ActionType != nil {
		actionType = pgtype.Text{String: string(*e.Evaluation.ActionType), Valid: true}
	}

	var satisfiedAt pgtype.Timestamptz
	if e.Evaluation.SatisfiedAt != nil {
		satisfiedAt = pgtype.Timestamptz{Time: *e.Evaluation.SatisfiedAt, Valid: true}
	}

	var nextEvaluationAt pgtype.Timestamptz
	if e.Evaluation.NextEvaluationTime != nil {
		nextEvaluationAt = pgtype.Timestamptz{Time: *e.Evaluation.NextEvaluationTime, Valid: true}
	}

	details := e.Evaluation.Details
	if details == nil {
		details = map[string]any{}
	}

	return db.BatchUpsertPolicyRuleEvaluationParams{
		RuleID:           uuid.MustParse(e.RuleID),
		EnvironmentID:    uuid.MustParse(e.EnvironmentID),
		VersionID:        uuid.MustParse(e.VersionID),
		ResourceID:       uuid.MustParse(e.ResourceID),
		Allowed:          e.Evaluation.Allowed,
		ActionRequired:   e.Evaluation.ActionRequired,
		ActionType:       actionType,
		Message:          e.Evaluation.Message,
		Details:          details,
		SatisfiedAt:      satisfiedAt,
		NextEvaluationAt: nextEvaluationAt,
	}
}
