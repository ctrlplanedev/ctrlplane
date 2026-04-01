-- name: ListVariableSetsWithVariablesByWorkspaceID :many
SELECT
  vs.id, vs.name, vs.description, vs.selector, vs.metadata, vs.priority, vs.workspace_id, vs.created_at, vs.updated_at,
  COALESCE(
    (SELECT json_agg(json_build_object('id', v.id, 'variableSetId', v.variable_set_id, 'key', v.key, 'value', v.value))
     FROM variable_set_variable v WHERE v.variable_set_id = vs.id),
    '[]'::json
  ) AS variables
FROM variable_set vs
WHERE vs.workspace_id = $1
ORDER BY vs.priority DESC;
