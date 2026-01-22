package db

import (
	"context"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const USER_APPROVAL_RECORD_SELECT_QUERY = `
	SELECT 
		pra.user_id,
		pra.deployment_version_id,
		pra.environment_id,
		pra.status,
		pra.reason,
		pra.created_at::text
	FROM policy_rule_any_approval_record pra
	INNER JOIN environment e ON e.id = pra.environment_id
	INNER JOIN system s ON s.id = e.system_id
	WHERE s.workspace_id = $1
`

func getUserApprovalRecords(ctx context.Context, workspaceID string) ([]*oapi.UserApprovalRecord, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, USER_APPROVAL_RECORD_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userApprovalRecords := make([]*oapi.UserApprovalRecord, 0)
	for rows.Next() {
		userApprovalRecord, err := scanUserApprovalRecord(rows)
		if err != nil {
			return nil, err
		}
		userApprovalRecords = append(userApprovalRecords, userApprovalRecord)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return userApprovalRecords, nil
}

func scanUserApprovalRecord(rows pgx.Rows) (*oapi.UserApprovalRecord, error) {
	var userApprovalRecord oapi.UserApprovalRecord
	err := rows.Scan(&userApprovalRecord.UserId, &userApprovalRecord.VersionId, &userApprovalRecord.EnvironmentId, &userApprovalRecord.Status, &userApprovalRecord.Reason, &userApprovalRecord.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &userApprovalRecord, nil
}

const USER_APPROVAL_RECORD_UPSERT_QUERY = `
	INSERT INTO policy_rule_any_approval_record (user_id, deployment_version_id, environment_id, status, reason, created_at)
	VALUES ($1, $2, $3, $4, $5, $6)
	ON CONFLICT (user_id, deployment_version_id, environment_id) DO UPDATE SET
		status = EXCLUDED.status,
		reason = EXCLUDED.reason,
		approved_at = EXCLUDED.approved_at,
		updated_at = NOW()
`

func writeUserApprovalRecord(ctx context.Context, userApprovalRecord *oapi.UserApprovalRecord, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, USER_APPROVAL_RECORD_UPSERT_QUERY, userApprovalRecord.UserId, userApprovalRecord.VersionId, userApprovalRecord.EnvironmentId, userApprovalRecord.Status, userApprovalRecord.Reason, userApprovalRecord.CreatedAt)
	if err != nil {
		return err
	}
	return nil
}

const DELETE_USER_APPROVAL_RECORD_QUERY = `
	DELETE FROM policy_rule_any_approval_record WHERE user_id = $1 AND deployment_version_id = $2 AND environment_id = $3
`

func deleteUserApprovalRecord(ctx context.Context, userApprovalRecord *oapi.UserApprovalRecord, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, DELETE_USER_APPROVAL_RECORD_QUERY, userApprovalRecord.UserId, userApprovalRecord.VersionId, userApprovalRecord.EnvironmentId)
	if err != nil {
		return err
	}
	return nil
}
