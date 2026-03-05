-- name: ListPolicySkipsForTarget :many
SELECT id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id
FROM policy_skip
WHERE version_id = $1
  AND (environment_id IS NULL OR environment_id = $2)
  AND (resource_id IS NULL OR resource_id = $3)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at ASC;
