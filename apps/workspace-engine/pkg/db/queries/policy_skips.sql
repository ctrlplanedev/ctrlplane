-- name: GetPolicySkipByID :one
SELECT id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id
FROM policy_skip
WHERE id = $1;

-- name: ListPolicySkipsByWorkspaceID :many
SELECT ps.id, ps.created_at, ps.created_by, ps.environment_id, ps.expires_at, ps.reason, ps.resource_id, ps.rule_id, ps.version_id
FROM policy_skip ps
INNER JOIN deployment_version dv ON dv.id = ps.version_id
WHERE dv.workspace_id = $1;

-- name: ListPolicySkipsByVersionID :many
SELECT id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id
FROM policy_skip
WHERE version_id = $1
  AND (expires_at IS NULL OR expires_at > NOW());

-- name: UpsertPolicySkip :exec
INSERT INTO policy_skip (id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id)
VALUES ($1, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()), $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE
SET created_by = EXCLUDED.created_by, environment_id = EXCLUDED.environment_id,
    expires_at = EXCLUDED.expires_at, reason = EXCLUDED.reason,
    resource_id = EXCLUDED.resource_id, rule_id = EXCLUDED.rule_id,
    version_id = EXCLUDED.version_id;

-- name: DeletePolicySkip :exec
DELETE FROM policy_skip WHERE id = $1;
