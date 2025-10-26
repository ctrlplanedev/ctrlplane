package db

import (
	"context"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const POLICY_SELECT_QUERY = `
	SELECT
		p.id,
		p.name,
		p.description,
		p.workspace_id,
		p.created_at,
		COALESCE(
			json_agg(
				jsonb_build_object(
					'id', pt.id,
					'deploymentSelector', pt.deployment_selector,
					'environmentSelector', pt.environment_selector,
					'resourceSelector', pt.resource_selector
				)
			) FILTER (WHERE pt.id IS NOT NULL),
			'[]'
		) AS targets,
		COALESCE(
			(
				SELECT jsonb_build_object(
					'id', pra.id,
					'policyId', pra.policy_id,
					'createdAt', pra.created_at,
					'minApprovals', pra.required_approvals_count
				)
				FROM policy_rule_any_approval pra
				WHERE pra.policy_id = p.id
				LIMIT 1
			),
			NULL
		) AS any_approval_rule,
		p.priority,
		p.enabled
	FROM policy p
	LEFT JOIN policy_target pt ON pt.policy_id = p.id
	LEFT JOIN policy_rule_any_approval pra ON pra.policy_id = p.id
	WHERE p.workspace_id = $1
	GROUP BY p.id
`

func getPolicies(ctx context.Context, workspaceID string) ([]*oapi.Policy, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, POLICY_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	policies := make([]*oapi.Policy, 0)
	for rows.Next() {
		policy, err := scanPolicyRow(rows)
		if err != nil {
			return nil, err
		}
		policies = append(policies, policy)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return policies, nil
}

type dbAnyApprovalRule struct {
	ID           string    `db:"id"`
	PolicyID     string    `db:"policyId"`
	CreatedAt    time.Time `db:"createdAt"`
	MinApprovals int32     `db:"minApprovals"`
}

type dbPolicyTargetSelector struct {
	Id                  string                 `json:"id"`
	DeploymentSelector  map[string]interface{} `json:"deploymentSelector"`
	EnvironmentSelector map[string]interface{} `json:"environmentSelector"`
	ResourceSelector    map[string]interface{} `json:"resourceSelector"`
}

func scanPolicyRow(rows pgx.Rows) (*oapi.Policy, error) {
	policy := &oapi.Policy{}
	var createdAt time.Time
	var priority int32
	var enabled bool
	var anyApprovalRuleRaw *dbAnyApprovalRule
	var description *string
	var dbSelectors []dbPolicyTargetSelector

	err := rows.Scan(
		&policy.Id,
		&policy.Name,
		&description,
		&policy.WorkspaceId,
		&createdAt,
		&dbSelectors,
		&anyApprovalRuleRaw,
		&priority,
		&enabled,
	)
	if err != nil {
		return nil, err
	}
	policy.Description = description
	policy.CreatedAt = createdAt.Format(time.RFC3339)

	// Convert database selectors to OAPI selectors with wrapping
	policy.Selectors = make([]oapi.PolicyTargetSelector, len(dbSelectors))
	for i, dbSel := range dbSelectors {
		deploymentSelector, err := wrapSelectorFromDB(dbSel.DeploymentSelector)
		if err != nil {
			return nil, fmt.Errorf("failed to wrap deployment selector: %w", err)
		}
		environmentSelector, err := wrapSelectorFromDB(dbSel.EnvironmentSelector)
		if err != nil {
			return nil, fmt.Errorf("failed to wrap environment selector: %w", err)
		}
		resourceSelector, err := wrapSelectorFromDB(dbSel.ResourceSelector)
		if err != nil {
			return nil, fmt.Errorf("failed to wrap resource selector: %w", err)
		}

		policy.Selectors[i] = oapi.PolicyTargetSelector{
			Id:                  dbSel.Id,
			DeploymentSelector:  deploymentSelector,
			EnvironmentSelector: environmentSelector,
			ResourceSelector:    resourceSelector,
		}
	}

	if anyApprovalRuleRaw != nil {
		policy.Rules = append(policy.Rules, oapi.PolicyRule{
			Id:        anyApprovalRuleRaw.ID,
			PolicyId:  anyApprovalRuleRaw.PolicyID,
			CreatedAt: anyApprovalRuleRaw.CreatedAt.Format(time.RFC3339),
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: anyApprovalRuleRaw.MinApprovals,
			},
		})
	}

	// Assign priority and enabled fields
	policy.Priority = int(priority)
	policy.Enabled = enabled
	policy.Metadata = map[string]string{}

	return policy, nil
}

const POLICY_UPSERT_QUERY = `
	INSERT INTO policy (id, name, description, workspace_id, created_at, enabled, priority)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		description = EXCLUDED.description,
		workspace_id = EXCLUDED.workspace_id,
		enabled = EXCLUDED.enabled,
		priority = EXCLUDED.priority
`

func writePolicy(ctx context.Context, policy *oapi.Policy, tx pgx.Tx) error {
	createdAt, err := time.Parse(time.RFC3339, policy.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to parse policy created_at: %w", err)
	}

	if _, err := tx.Exec(
		ctx,
		POLICY_UPSERT_QUERY,
		policy.Id,
		policy.Name,
		policy.Description,
		policy.WorkspaceId,
		createdAt,
		policy.Enabled,
		policy.Priority,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, "DELETE FROM policy_target WHERE policy_id = $1", policy.Id); err != nil {
		return fmt.Errorf("failed to delete existing selectors: %w", err)
	}

	if len(policy.Selectors) > 0 {
		if err := writeManySelectors(ctx, policy.Id, policy.Selectors, tx); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, "DELETE FROM policy_rule_any_approval WHERE policy_id = $1", policy.Id); err != nil {
		return fmt.Errorf("failed to delete existing any-approval rule: %w", err)
	}

	for _, rule := range policy.Rules {
		if rule.AnyApproval != nil {
			if err := writeApprovalAnyRule(ctx, policy.Id, rule, *rule.AnyApproval, tx); err != nil {
				return err
			}
		}
	}

	return nil
}

func writeManySelectors(ctx context.Context, policyId string, selectors []oapi.PolicyTargetSelector, tx pgx.Tx) error {
	if len(selectors) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(selectors))
	valueArgs := make([]interface{}, 0, len(selectors)*5)
	i := 1
	for _, selector := range selectors {
		// Unwrap selectors for database storage
		deploymentSelector, err := unwrapSelectorForDB(selector.DeploymentSelector)
		if err != nil {
			return fmt.Errorf("failed to unwrap deployment selector: %w", err)
		}
		environmentSelector, err := unwrapSelectorForDB(selector.EnvironmentSelector)
		if err != nil {
			return fmt.Errorf("failed to unwrap environment selector: %w", err)
		}
		resourceSelector, err := unwrapSelectorForDB(selector.ResourceSelector)
		if err != nil {
			return fmt.Errorf("failed to unwrap resource selector: %w", err)
		}

		valueStrings = append(valueStrings, "($"+fmt.Sprintf("%d", i)+", $"+fmt.Sprintf("%d", i+1)+", $"+fmt.Sprintf("%d", i+2)+", $"+fmt.Sprintf("%d", i+3)+", $"+fmt.Sprintf("%d", i+4)+")")
		valueArgs = append(valueArgs, selector.Id, policyId, deploymentSelector, environmentSelector, resourceSelector)
		i += 5
	}

	query := "INSERT INTO policy_target (id, policy_id, deployment_selector, environment_selector, resource_selector) VALUES " +
		strings.Join(valueStrings, ", ") +
		" ON CONFLICT (id) DO UPDATE SET policy_id = EXCLUDED.policy_id, deployment_selector = EXCLUDED.deployment_selector, environment_selector = EXCLUDED.environment_selector, resource_selector = EXCLUDED.resource_selector"

	_, err := tx.Exec(ctx, query, valueArgs...)
	if err != nil {
		return err
	}
	return nil
}

const APPROVAL_ANY_RULE_UPSERT_QUERY = `
	INSERT INTO policy_rule_any_approval (id, policy_id, created_at, required_approvals_count)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (id) DO UPDATE SET
		policy_id = EXCLUDED.policy_id,
		required_approvals_count = EXCLUDED.required_approvals_count
`

func writeApprovalAnyRule(ctx context.Context, policyId string, rule oapi.PolicyRule, anyApproval oapi.AnyApprovalRule, tx pgx.Tx) error {
	createdAt, err := time.Parse(time.RFC3339, rule.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to parse rule created_at: %w", err)
	}

	if _, err := tx.Exec(ctx, APPROVAL_ANY_RULE_UPSERT_QUERY, rule.Id, policyId, createdAt, anyApproval.MinApprovals); err != nil {
		return err
	}
	return nil
}

const DELETE_POLICY_QUERY = `
	DELETE FROM policy WHERE id = $1
`

func deletePolicy(ctx context.Context, policyId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_POLICY_QUERY, policyId); err != nil {
		return err
	}
	return nil
}
