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

-- name: FindOrCreateRelease :one
-- Returns an existing release if one already exists for the same release target
-- with the same version and exact set of variables, otherwise creates a new one.
WITH existing AS (
  SELECT r.id
  FROM release r
  WHERE r.resource_id = @resource_id
    AND r.environment_id = @environment_id
    AND r.deployment_id = @deployment_id
    AND r.version_id = @version_id
    AND (SELECT count(*) FROM release_variable rv WHERE rv.release_id = r.id)
      = COALESCE(array_length(@variable_keys::text[], 1), 0)
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(@variable_keys::text[], @variable_values::jsonb[]) AS vi(key, value)
      WHERE NOT EXISTS (
        SELECT 1 FROM release_variable rv
        WHERE rv.release_id = r.id AND rv.key = vi.key AND rv.value = vi.value
      )
    )
  LIMIT 1
),
inserted AS (
  INSERT INTO release (id, resource_id, environment_id, deployment_id, version_id)
  SELECT @id, @resource_id, @environment_id, @deployment_id, @version_id
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING *
),
inserted_vars AS (
  INSERT INTO release_variable (release_id, key, value)
  SELECT (SELECT id FROM inserted), vi.key, vi.value
  FROM unnest(@variable_keys::text[], @variable_values::jsonb[]) AS vi(key, value)
  WHERE EXISTS (SELECT 1 FROM inserted)
)
SELECT * FROM inserted
UNION ALL
SELECT * FROM release WHERE id = (SELECT id FROM existing)
LIMIT 1;

-- name: UpsertReleaseDesired :one
INSERT INTO release_target_desired_release (
    resource_id,
    environment_id,
    deployment_id,
    desired_release_id
) VALUES (
    $1, $2, $3, NULLIF(@desired_release_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
ON CONFLICT (resource_id, environment_id, deployment_id) DO UPDATE
SET 
    desired_release_id = EXCLUDED.desired_release_id
RETURNING *;

-- name: GetDesiredReleaseByReleaseTarget :one
SELECT r.*
FROM release_target_desired_release rtr
JOIN release r ON r.id = rtr.desired_release_id
WHERE rtr.resource_id = $1 AND rtr.environment_id = $2 AND rtr.deployment_id = $3;
