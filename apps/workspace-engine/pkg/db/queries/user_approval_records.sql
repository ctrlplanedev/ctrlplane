-- name: GetUserApprovalRecord :one
SELECT version_id, user_id, environment_id, status, reason, created_at
FROM user_approval_record
WHERE version_id = $1 AND user_id = $2 AND environment_id = $3;

-- name: UpsertUserApprovalRecord :exec
INSERT INTO user_approval_record (version_id, user_id, environment_id, status, reason, created_at)
VALUES ($1, $2, $3, $4, $5, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (version_id, user_id, environment_id) DO UPDATE
SET status = EXCLUDED.status, reason = EXCLUDED.reason;

-- name: DeleteUserApprovalRecord :exec
DELETE FROM user_approval_record
WHERE version_id = $1 AND user_id = $2 AND environment_id = $3;

-- name: ListApprovedRecordsByVersionAndEnvironment :many
SELECT version_id, user_id, environment_id, status, reason, created_at
FROM user_approval_record
WHERE version_id = $1 AND environment_id = $2 AND status = 'approved'
ORDER BY created_at ASC;

-- name: ListUserApprovalRecordsByVersionID :many
SELECT version_id, user_id, environment_id, status, reason, created_at
FROM user_approval_record
WHERE version_id = $1;
