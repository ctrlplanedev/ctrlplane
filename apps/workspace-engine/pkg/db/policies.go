package db

import (
	"context"
	"time"
	"workspace-engine/pkg/pb"

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
	) AS targets

	, 
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
	) AS any_approval_rule

	FROM policy p
	LEFT JOIN policy_target pt ON pt.policy_id = p.id
	LEFT JOIN policy_rule_any_approval pra ON pra.policy_id = p.id
	WHERE p.workspace_id = $1
	GROUP BY p.id
`

func getPolicies(ctx context.Context, workspaceID string) ([]*pb.Policy, error) {
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

	policies := make([]*pb.Policy, 0)
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

func scanPolicyRow(rows pgx.Rows) (*pb.Policy, error) {
	policy := &pb.Policy{}
	var createdAt time.Time
	var anyApprovalRuleRaw *dbAnyApprovalRule

	err := rows.Scan(
		&policy.Id,
		&policy.Name,
		&policy.Description,
		&policy.WorkspaceId,
		&createdAt,
		&policy.Selectors,
		&anyApprovalRuleRaw,
	)
	if err != nil {
		return nil, err
	}
	policy.CreatedAt = createdAt.Format(time.RFC3339)

	if anyApprovalRuleRaw != nil {
		policy.Rules = append(policy.Rules, &pb.PolicyRule{
			Id:        anyApprovalRuleRaw.ID,
			PolicyId:  anyApprovalRuleRaw.PolicyID,
			CreatedAt: anyApprovalRuleRaw.CreatedAt.Format(time.RFC3339),
			Rule: &pb.PolicyRule_AnyApproval{
				AnyApproval: &pb.AnyApprovalRule{
					MinApprovals: anyApprovalRuleRaw.MinApprovals,
				},
			},
		})
	}

	return policy, nil
}
