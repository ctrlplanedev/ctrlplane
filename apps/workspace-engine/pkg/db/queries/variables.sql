-- name: ListVariablesWithValuesByDeploymentID :many
SELECT
  v.id,
  v.scope,
  v.deployment_id,
  v.resource_id,
  v.job_agent_id,
  v.key,
  v.is_sensitive,
  v.description,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', vv.id,
          'variableId', vv.variable_id,
          'resourceSelector', vv.resource_selector,
          'priority', vv.priority,
          'kind', vv.kind,
          'literalValue', vv.literal_value,
          'refKey', vv.ref_key,
          'refPath', vv.ref_path,
          'secretProvider', vv.secret_provider,
          'secretKey', vv.secret_key,
          'secretPath', vv.secret_path
        )
        ORDER BY vv.priority DESC, vv.id ASC
      )
      FROM variable_value vv
      WHERE vv.variable_id = v.id
    ),
    '[]'::json
  ) AS values
FROM variable v
WHERE v.scope = 'deployment' AND v.deployment_id = $1;

-- name: ListVariablesWithValuesByResourceID :many
SELECT
  v.id,
  v.scope,
  v.deployment_id,
  v.resource_id,
  v.job_agent_id,
  v.key,
  v.is_sensitive,
  v.description,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', vv.id,
          'variableId', vv.variable_id,
          'resourceSelector', vv.resource_selector,
          'priority', vv.priority,
          'kind', vv.kind,
          'literalValue', vv.literal_value,
          'refKey', vv.ref_key,
          'refPath', vv.ref_path,
          'secretProvider', vv.secret_provider,
          'secretKey', vv.secret_key,
          'secretPath', vv.secret_path
        )
        ORDER BY vv.priority DESC, vv.id ASC
      )
      FROM variable_value vv
      WHERE vv.variable_id = v.id
    ),
    '[]'::json
  ) AS values
FROM variable v
WHERE v.scope = 'resource' AND v.resource_id = $1;

-- name: ListResourceVariablesWithValuesByWorkspaceID :many
SELECT
  v.id,
  v.scope,
  v.resource_id,
  v.key,
  v.is_sensitive,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', vv.id,
          'variableId', vv.variable_id,
          'resourceSelector', vv.resource_selector,
          'priority', vv.priority,
          'kind', vv.kind,
          'literalValue', vv.literal_value,
          'refKey', vv.ref_key,
          'refPath', vv.ref_path,
          'secretProvider', vv.secret_provider,
          'secretKey', vv.secret_key,
          'secretPath', vv.secret_path
        )
        ORDER BY vv.priority DESC, vv.id ASC
      )
      FROM variable_value vv
      WHERE vv.variable_id = v.id
    ),
    '[]'::json
  ) AS values
FROM variable v
INNER JOIN resource r ON r.id = v.resource_id
WHERE v.scope = 'resource' AND r.workspace_id = $1 AND r.deleted_at IS NULL;
