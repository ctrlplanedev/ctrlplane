-- Backfill deployment variables. ON CONFLICT DO NOTHING (no target) catches
-- both PK and (deployment_id, key) partial-unique collisions so this is safe
-- to re-run when new rows have been added to the legacy tables after an
-- earlier backfill.
INSERT INTO "variable" (id, scope, deployment_id, key, is_sensitive, description)
SELECT
  dv.id,
  'deployment'::variable_scope,
  dv.deployment_id,
  dv.key,
  false,
  dv.description
FROM deployment_variable dv
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Preserve deployment_variable.default_value as a null-selector literal at
-- MIN_BIGINT priority so any real variable_value shadows it while non-matching
-- resources still fall through to the old default. Join via (deployment_id,
-- key) so the default attaches to whichever variable currently owns the key.
INSERT INTO "variable_value" (variable_id, priority, kind, literal_value)
SELECT
  v.id,
  -10,
  'literal'::variable_value_kind,
  dv.default_value
FROM deployment_variable dv
JOIN "variable" v
  ON v.scope = 'deployment'
 AND v.deployment_id = dv.deployment_id
 AND v.key = dv.key
WHERE dv.default_value IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "variable_value" vv
    WHERE vv.variable_id = v.id
      AND vv.resource_selector IS NULL
      AND vv.priority = -10
  );
--> statement-breakpoint

-- Classify + dedupe deployment_variable_value rows, then insert refs.
-- Uses (deployment_id, key) mapping so values attach to the current owner of
-- the key even if the new `variable` row has a different id than the legacy
-- `deployment_variable` row.
WITH dvv_classified AS (
  SELECT
    dvv.id,
    v.id AS variable_id,
    dvv.resource_selector,
    dvv.priority,
    dvv.value,
    CASE
      WHEN jsonb_typeof(dvv.value) = 'object'
       AND dvv.value ? 'reference'
       AND (
         dvv.value->'path' IS NULL
         OR jsonb_typeof(dvv.value->'path') = 'array'
       )
      THEN 'ref'
      ELSE 'literal'
    END AS kind,
    ROW_NUMBER() OVER (
      PARTITION BY
        v.id,
        COALESCE(dvv.resource_selector, '<<NULL>>'),
        dvv.priority
      ORDER BY dvv.id
    ) AS rn
  FROM deployment_variable_value dvv
  JOIN deployment_variable dv ON dv.id = dvv.deployment_variable_id
  JOIN "variable" v
    ON v.scope = 'deployment'
   AND v.deployment_id = dv.deployment_id
   AND v.key = dv.key
)
INSERT INTO "variable_value" (
  id, variable_id, resource_selector, priority, kind, ref_key, ref_path
)
SELECT
  c.id,
  c.variable_id,
  c.resource_selector,
  c.priority,
  'ref'::variable_value_kind,
  c.value->>'reference',
  CASE
    WHEN jsonb_typeof(c.value->'path') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(c.value->'path'))
    ELSE ARRAY[]::text[]
  END
FROM dvv_classified c
WHERE c.kind = 'ref'
  AND c.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM "variable_value" vv
    WHERE vv.variable_id = c.variable_id
      AND vv.resource_selector IS NOT DISTINCT FROM c.resource_selector
      AND vv.priority = c.priority
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint

WITH dvv_classified AS (
  SELECT
    dvv.id,
    v.id AS variable_id,
    dvv.resource_selector,
    dvv.priority,
    dvv.value,
    CASE
      WHEN jsonb_typeof(dvv.value) = 'object'
       AND dvv.value ? 'reference'
       AND (
         dvv.value->'path' IS NULL
         OR jsonb_typeof(dvv.value->'path') = 'array'
       )
      THEN 'ref'
      ELSE 'literal'
    END AS kind,
    ROW_NUMBER() OVER (
      PARTITION BY
        v.id,
        COALESCE(dvv.resource_selector, '<<NULL>>'),
        dvv.priority
      ORDER BY dvv.id
    ) AS rn
  FROM deployment_variable_value dvv
  JOIN deployment_variable dv ON dv.id = dvv.deployment_variable_id
  JOIN "variable" v
    ON v.scope = 'deployment'
   AND v.deployment_id = dv.deployment_id
   AND v.key = dv.key
)
INSERT INTO "variable_value" (
  id, variable_id, resource_selector, priority, kind, literal_value
)
SELECT
  c.id,
  c.variable_id,
  c.resource_selector,
  c.priority,
  'literal'::variable_value_kind,
  c.value
FROM dvv_classified c
WHERE c.kind = 'literal'
  AND c.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM "variable_value" vv
    WHERE vv.variable_id = c.variable_id
      AND vv.resource_selector IS NOT DISTINCT FROM c.resource_selector
      AND vv.priority = c.priority
  )
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable" (scope, resource_id, key, is_sensitive)
SELECT
  'resource'::variable_scope,
  rv.resource_id,
  rv.key,
  false
FROM resource_variable rv
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "variable_value" (variable_id, priority, kind, ref_key, ref_path)
SELECT
  v.id,
  0,
  'ref'::variable_value_kind,
  rv.value->>'reference',
  CASE
    WHEN jsonb_typeof(rv.value->'path') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(rv.value->'path'))
    ELSE ARRAY[]::text[]
  END
FROM resource_variable rv
JOIN "variable" v
  ON v.scope = 'resource'
 AND v.resource_id = rv.resource_id
 AND v.key = rv.key
WHERE jsonb_typeof(rv.value) = 'object'
  AND rv.value ? 'reference'
  AND (
    rv.value->'path' IS NULL
    OR jsonb_typeof(rv.value->'path') = 'array'
  )
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
  AND (
    rv.value->'path' IS NULL
    OR jsonb_typeof(rv.value->'path') = 'array'
  )
)
AND NOT EXISTS (
  SELECT 1 FROM "variable_value" vv
  WHERE vv.variable_id = v.id
    AND vv.resource_selector IS NULL
    AND vv.priority = 0
);
