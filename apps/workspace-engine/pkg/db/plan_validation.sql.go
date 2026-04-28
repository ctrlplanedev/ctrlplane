package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const upsertPlanTargetResultValidation = `-- name: UpsertPlanTargetResultValidation :exec
INSERT INTO deployment_plan_target_result_validation (result_id, rule_id, passed, violations, evaluated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (result_id, rule_id) DO UPDATE
SET passed = EXCLUDED.passed,
    violations = EXCLUDED.violations,
    evaluated_at = EXCLUDED.evaluated_at
`

type UpsertPlanTargetResultValidationParams struct {
	ResultID   uuid.UUID
	RuleID     uuid.UUID
	Passed     bool
	Violations []byte
}

func (q *Queries) UpsertPlanTargetResultValidation(ctx context.Context, arg UpsertPlanTargetResultValidationParams) error {
	_, err := q.db.Exec(ctx, upsertPlanTargetResultValidation,
		arg.ResultID,
		arg.RuleID,
		arg.Passed,
		arg.Violations,
	)
	return err
}

const listPlanTargetResultValidationsByResultID = `-- name: ListPlanTargetResultValidationsByResultID :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at
FROM deployment_plan_target_result_validation v
WHERE v.result_id = $1
ORDER BY v.evaluated_at
`

type PlanTargetResultValidation struct {
	ID          uuid.UUID
	ResultID    uuid.UUID
	RuleID      uuid.UUID
	Passed      bool
	Violations  []byte
	EvaluatedAt pgtype.Timestamptz
}

func (q *Queries) ListPlanTargetResultValidationsByResultID(ctx context.Context, resultID uuid.UUID) ([]PlanTargetResultValidation, error) {
	rows, err := q.db.Query(ctx, listPlanTargetResultValidationsByResultID, resultID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PlanTargetResultValidation
	for rows.Next() {
		var i PlanTargetResultValidation
		if err := rows.Scan(
			&i.ID,
			&i.ResultID,
			&i.RuleID,
			&i.Passed,
			&i.Violations,
			&i.EvaluatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listPlanTargetResultValidationsByTargetID = `-- name: ListPlanTargetResultValidationsByTargetID :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at
FROM deployment_plan_target_result_validation v
JOIN deployment_plan_target_result r ON r.id = v.result_id
WHERE r.target_id = $1
ORDER BY v.evaluated_at
`

func (q *Queries) ListPlanTargetResultValidationsByTargetID(ctx context.Context, targetID uuid.UUID) ([]PlanTargetResultValidation, error) {
	rows, err := q.db.Query(ctx, listPlanTargetResultValidationsByTargetID, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PlanTargetResultValidation
	for rows.Next() {
		var i PlanTargetResultValidation
		if err := rows.Scan(
			&i.ID,
			&i.ResultID,
			&i.RuleID,
			&i.Passed,
			&i.Violations,
			&i.EvaluatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listPlanValidationRulesByPolicyID = `-- name: ListPlanValidationRulesByPolicyID :many
SELECT id, policy_id, name, description, rego, severity, created_at
FROM policy_rule_plan_validation
WHERE policy_id = $1
`

type PolicyRulePlanValidation struct {
	ID          uuid.UUID
	PolicyID    uuid.UUID
	Name        string
	Description pgtype.Text
	Rego        string
	Severity    string
	CreatedAt   pgtype.Timestamptz
}

func (q *Queries) ListPlanValidationRulesByPolicyID(ctx context.Context, policyID uuid.UUID) ([]PolicyRulePlanValidation, error) {
	rows, err := q.db.Query(ctx, listPlanValidationRulesByPolicyID, policyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PolicyRulePlanValidation
	for rows.Next() {
		var i PolicyRulePlanValidation
		if err := rows.Scan(
			&i.ID,
			&i.PolicyID,
			&i.Name,
			&i.Description,
			&i.Rego,
			&i.Severity,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const upsertPlanValidationRule = `-- name: UpsertPlanValidationRule :exec
INSERT INTO policy_rule_plan_validation (id, policy_id, name, description, rego, severity, created_at)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    rego = EXCLUDED.rego, severity = EXCLUDED.severity
`

type UpsertPlanValidationRuleParams struct {
	ID          uuid.UUID
	PolicyID    uuid.UUID
	Name        string
	Description pgtype.Text
	Rego        string
	Severity    string
	CreatedAt   pgtype.Timestamptz
}

func (q *Queries) UpsertPlanValidationRule(ctx context.Context, arg UpsertPlanValidationRuleParams) error {
	_, err := q.db.Exec(ctx, upsertPlanValidationRule,
		arg.ID,
		arg.PolicyID,
		arg.Name,
		arg.Description,
		arg.Rego,
		arg.Severity,
		arg.CreatedAt,
	)
	return err
}

const deletePlanValidationRulesByPolicyID = `-- name: DeletePlanValidationRulesByPolicyID :exec
DELETE FROM policy_rule_plan_validation WHERE policy_id = $1
`

func (q *Queries) DeletePlanValidationRulesByPolicyID(ctx context.Context, policyID uuid.UUID) error {
	_, err := q.db.Exec(ctx, deletePlanValidationRulesByPolicyID, policyID)
	return err
}

const getLatestPlanValidationsForTarget = `-- name: GetLatestPlanValidationsForTarget :many
SELECT
  v.id,
  v.result_id,
  v.rule_id,
  v.passed,
  v.violations,
  v.evaluated_at,
  r.name AS rule_name,
  r.severity
FROM deployment_plan_target_result_validation v
JOIN policy_rule_plan_validation r ON r.id = v.rule_id
JOIN deployment_plan_target_result res ON res.id = v.result_id
JOIN deployment_plan_target t ON t.id = res.target_id
JOIN deployment_plan dp ON dp.id = t.plan_id
WHERE t.environment_id = $1
  AND t.resource_id = $2
  AND dp.deployment_id = $3
ORDER BY v.evaluated_at DESC
`

type GetLatestPlanValidationsForTargetParams struct {
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
	DeploymentID  uuid.UUID
}

type GetLatestPlanValidationsForTargetRow struct {
	ID          uuid.UUID
	ResultID    uuid.UUID
	RuleID      uuid.UUID
	Passed      bool
	Violations  []byte
	EvaluatedAt pgtype.Timestamptz
	RuleName    string
	Severity    string
}

func (q *Queries) GetLatestPlanValidationsForTarget(ctx context.Context, arg GetLatestPlanValidationsForTargetParams) ([]GetLatestPlanValidationsForTargetRow, error) {
	rows, err := q.db.Query(ctx, getLatestPlanValidationsForTarget,
		arg.EnvironmentID,
		arg.ResourceID,
		arg.DeploymentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []GetLatestPlanValidationsForTargetRow
	for rows.Next() {
		var i GetLatestPlanValidationsForTargetRow
		if err := rows.Scan(
			&i.ID,
			&i.ResultID,
			&i.RuleID,
			&i.Passed,
			&i.Violations,
			&i.EvaluatedAt,
			&i.RuleName,
			&i.Severity,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listPlanValidationRulesByWorkspaceID = `-- name: ListPlanValidationRulesByWorkspaceID :many
SELECT r.id, r.policy_id, r.name, r.description, r.rego, r.severity, r.created_at,
       p.selector AS policy_selector
FROM policy_rule_plan_validation r
JOIN policy p ON p.id = r.policy_id
WHERE p.workspace_id = $1 AND p.enabled = true
`

type ListPlanValidationRulesByWorkspaceIDRow struct {
	ID             uuid.UUID
	PolicyID       uuid.UUID
	Name           string
	Description    pgtype.Text
	Rego           string
	Severity       string
	CreatedAt      pgtype.Timestamptz
	PolicySelector string
}

func (q *Queries) ListPlanValidationRulesByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]ListPlanValidationRulesByWorkspaceIDRow, error) {
	rows, err := q.db.Query(ctx, listPlanValidationRulesByWorkspaceID, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListPlanValidationRulesByWorkspaceIDRow
	for rows.Next() {
		var i ListPlanValidationRulesByWorkspaceIDRow
		if err := rows.Scan(
			&i.ID,
			&i.PolicyID,
			&i.Name,
			&i.Description,
			&i.Rego,
			&i.Severity,
			&i.CreatedAt,
			&i.PolicySelector,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
