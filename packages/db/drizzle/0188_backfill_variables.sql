INSERT INTO "variable" (id, scope, deployment_id, key, is_sensitive, description)
SELECT
  dv.id,
  'deployment'::variable_scope,
  dv.deployment_id,
  dv.key,
  false,
  dv.description
FROM deployment_variable dv
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable_value" (
  id, variable_id, resource_selector, priority, kind, ref_key, ref_path
)
SELECT
  dvv.id,
  dvv.deployment_variable_id,
  dvv.resource_selector,
  dvv.priority,
  'ref'::variable_value_kind,
  dvv.value->>'reference',
  ARRAY(SELECT jsonb_array_elements_text(dvv.value->'path'))
FROM deployment_variable_value dvv
WHERE jsonb_typeof(dvv.value) = 'object'
  AND dvv.value ? 'reference'
  AND dvv.value ? 'path'
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable_value" (
  id, variable_id, resource_selector, priority, kind, literal_value
)
SELECT
  dvv.id,
  dvv.deployment_variable_id,
  dvv.resource_selector,
  dvv.priority,
  'literal'::variable_value_kind,
  dvv.value
FROM deployment_variable_value dvv
WHERE NOT (
  jsonb_typeof(dvv.value) = 'object'
  AND dvv.value ? 'reference'
  AND dvv.value ? 'path'
)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable" (scope, resource_id, key, is_sensitive)
SELECT
  'resource'::variable_scope,
  rv.resource_id,
  rv.key,
  false
FROM resource_variable rv
ON CONFLICT (resource_id, key) WHERE resource_id IS NOT NULL DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable_value" (variable_id, priority, kind, ref_key, ref_path)
SELECT
  v.id,
  0,
  'ref'::variable_value_kind,
  rv.value->>'reference',
  ARRAY(SELECT jsonb_array_elements_text(rv.value->'path'))
FROM resource_variable rv
JOIN "variable" v
  ON v.scope = 'resource'
 AND v.resource_id = rv.resource_id
 AND v.key = rv.key
WHERE jsonb_typeof(rv.value) = 'object'
  AND rv.value ? 'reference'
  AND rv.value ? 'path'
  AND NOT EXISTS (
    SELECT 1 FROM "variable_value" vv
    WHERE vv.variable_id = v.id
      AND vv.resource_selector IS NULL
      AND vv.priority = 0
  );
--> statement-breakpoint

INSERT INTO "variable_value" (variable_id, priority, kind, literal_value)
SELECT
  v.id,
  0,
  'literal'::variable_value_kind,
  rv.value
FROM resource_variable rv
JOIN "variable" v
  ON v.scope = 'resource'
 AND v.resource_id = rv.resource_id
 AND v.key = rv.key
WHERE NOT (
  jsonb_typeof(rv.value) = 'object'
  AND rv.value ? 'reference'
  AND rv.value ? 'path'
)
AND NOT EXISTS (
  SELECT 1 FROM "variable_value" vv
  WHERE vv.variable_id = v.id
    AND vv.resource_selector IS NULL
    AND vv.priority = 0
);
