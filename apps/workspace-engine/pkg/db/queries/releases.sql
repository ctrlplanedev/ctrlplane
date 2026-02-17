-- name: GetReleaseByID :one
SELECT * FROM release WHERE id = $1;

-- name: ListReleasesByReleaseTarget :many
SELECT * FROM release
WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3;

-- name: ListReleasesByWorkspaceID :many
SELECT r.id, r.resource_id, r.environment_id, r.deployment_id, r.version_id, r.created_at
FROM release r
JOIN deployment d ON d.id = r.deployment_id
WHERE d.workspace_id = $1
LIMIT COALESCE(sqlc.narg('limit')::int, 5000);

-- name: GetReleaseVariablesByReleaseID :many
SELECT * FROM release_variable WHERE release_id = $1;

-- name: UpsertRelease :one
INSERT INTO release (id, resource_id, environment_id, deployment_id, version_id, created_at)
VALUES ($1, $2, $3, $4, $5, COALESCE(sqlc.narg('created_at')::timestamptz, NOW()))
ON CONFLICT (id) DO UPDATE
SET resource_id = EXCLUDED.resource_id,
    environment_id = EXCLUDED.environment_id,
    deployment_id = EXCLUDED.deployment_id,
    version_id = EXCLUDED.version_id
RETURNING *;

-- name: UpsertReleaseVariable :one
INSERT INTO release_variable (id, release_id, key, value, encrypted)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (release_id, key) DO UPDATE
SET value = EXCLUDED.value, encrypted = EXCLUDED.encrypted
RETURNING *;

-- name: DeleteRelease :exec
DELETE FROM release WHERE id = $1;

-- name: DeleteReleaseVariablesByReleaseID :exec
DELETE FROM release_variable WHERE release_id = $1;
