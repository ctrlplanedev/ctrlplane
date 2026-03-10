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
	RuleType      string
	RuleID        string
	EnvironmentID string
	VersionID     string
	ResourceID    string
	Evaluation    *oapi.RuleEvaluation
}

var _ UpsertRuleEvaluations = (*PostgresUpsertRuleEvaluations)(nil)

func NewPostgresUpsertRuleEvaluations(ruleTypes []string) UpsertRuleEvaluations {
	return &PostgresUpsertRuleEvaluations{
		ruleTypes: ruleTypes,
	}
}

type PostgresUpsertRuleEvaluations struct {
	ruleTypes []string
}

type scopeKey struct {
	EnvironmentID uuid.UUID
	VersionID     uuid.UUID
	ResourceID    uuid.UUID
}

func (p *PostgresUpsertRuleEvaluations) UpsertRuleEvaluations(ctx context.Context, evaluations []RuleEvaluationParams) error {
	ctx, span := tracer.Start(ctx, "Store.UpsertRuleEvaluations")
	defer span.End()

	if len(evaluations) == 0 {
		return nil
	}

	batchParams := make([]db.BatchUpsertPolicyRuleEvaluationParams, 0, len(evaluations))
	ruleIDsByScope := make(map[scopeKey][]uuid.UUID)

	for _, e := range evaluations {
		dbParams, err := toDBParams(e)
		if err != nil {
			return fmt.Errorf("to db params: %w", err)
		}
		batchParams = append(batchParams, dbParams)

		key := scopeKey{
			EnvironmentID: dbParams.EnvironmentID,
			VersionID:     dbParams.VersionID,
			ResourceID:    dbParams.ResourceID,
		}
		ruleIDsByScope[key] = append(ruleIDsByScope[key], dbParams.RuleID)
	}

	results := db.GetQueries(ctx).BatchUpsertPolicyRuleEvaluation(ctx, batchParams)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = fmt.Errorf("batch upsert policy rule evaluation %d: %w", i, err)
		}
	})
	if batchErr != nil {
		return batchErr
	}

	q := db.GetQueries(ctx)
	for scope, ruleIDs := range ruleIDsByScope {
		err := q.DeleteStalePolicyRuleEvaluations(ctx, db.DeleteStalePolicyRuleEvaluationsParams{
			EnvironmentID: scope.EnvironmentID,
			VersionID:     scope.VersionID,
			ResourceID:    scope.ResourceID,
			RuleTypes:     p.ruleTypes,
			KeepRuleIds:   ruleIDs,
		})
		if err != nil {
			return fmt.Errorf("delete stale policy rule evaluations: %w", err)
		}
	}

	return nil
}

func toDBParams(e RuleEvaluationParams) (db.BatchUpsertPolicyRuleEvaluationParams, error) {
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

	ruleID, err := uuid.Parse(e.RuleID)
	if err != nil {
		return db.BatchUpsertPolicyRuleEvaluationParams{}, fmt.Errorf("parse rule id: %w", err)
	}
	environmentID, err := uuid.Parse(e.EnvironmentID)
	if err != nil {
		return db.BatchUpsertPolicyRuleEvaluationParams{}, fmt.Errorf("parse environment id: %w", err)
	}
	versionID, err := uuid.Parse(e.VersionID)
	if err != nil {
		return db.BatchUpsertPolicyRuleEvaluationParams{}, fmt.Errorf("parse version id: %w", err)
	}
	resourceID, err := uuid.Parse(e.ResourceID)
	if err != nil {
		return db.BatchUpsertPolicyRuleEvaluationParams{}, fmt.Errorf("parse resource id: %w", err)
	}

	return db.BatchUpsertPolicyRuleEvaluationParams{
		RuleType:         e.RuleType,
		RuleID:           ruleID,
		EnvironmentID:    environmentID,
		VersionID:        versionID,
		ResourceID:       resourceID,
		Allowed:          e.Evaluation.Allowed,
		ActionRequired:   e.Evaluation.ActionRequired,
		ActionType:       actionType,
		Message:          e.Evaluation.Message,
		Details:          details,
		SatisfiedAt:      satisfiedAt,
		NextEvaluationAt: nextEvaluationAt,
	}, nil
}
