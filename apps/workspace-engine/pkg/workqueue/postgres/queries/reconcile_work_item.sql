-- name: UpsertReconcileWorkItem :exec
-- Upsert scope scheduling metadata, then upsert payload variant under that scope.
WITH upsert_scope AS (
  INSERT INTO reconcile_work_scope (
    workspace_id, kind, scope_type, scope_id, event_ts, priority, not_before,
    claimed_by, claimed_until, created_at, updated_at
  ) VALUES (
    sqlc.arg(workspace_id), sqlc.arg(kind), sqlc.arg(scope_type), sqlc.arg(scope_id), sqlc.arg(event_ts), sqlc.arg(priority), sqlc.arg(not_before),
    NULL, NULL, now(), now()
  )
  ON CONFLICT (workspace_id, kind, scope_type, scope_id)
  DO UPDATE SET
    event_ts = GREATEST(reconcile_work_scope.event_ts, EXCLUDED.event_ts),
    priority = LEAST(reconcile_work_scope.priority, EXCLUDED.priority),
    not_before = LEAST(reconcile_work_scope.not_before, EXCLUDED.not_before),
    -- Keep claim timestamp stable while a lease is active so ack/retry can
    -- separate payloads claimed at lease-time from payloads added later.
    updated_at = CASE
      WHEN reconcile_work_scope.claimed_until IS NOT NULL
        AND reconcile_work_scope.claimed_until >= now()
      THEN reconcile_work_scope.updated_at
      ELSE now()
    END,
    claimed_by = CASE
      WHEN reconcile_work_scope.claimed_until IS NOT NULL
        AND reconcile_work_scope.claimed_until < now()
      THEN NULL
      ELSE reconcile_work_scope.claimed_by
    END,
    claimed_until = CASE
      WHEN reconcile_work_scope.claimed_until IS NOT NULL
        AND reconcile_work_scope.claimed_until < now()
      THEN NULL
      ELSE reconcile_work_scope.claimed_until
    END
  RETURNING id
)
INSERT INTO reconcile_work_payload (
  scope_ref, payload_type, payload_key, payload, attempt_count, last_error, created_at, updated_at
)
SELECT
  id, sqlc.arg(payload_type), sqlc.arg(payload_key), sqlc.arg(payload), 0, NULL, now(), now()
FROM upsert_scope
WHERE sqlc.arg(has_payload)::bool
ON CONFLICT (scope_ref, payload_type, payload_key)
DO UPDATE SET
  payload = EXCLUDED.payload,
  -- Treat payload updates as a new unit of work for claim-snapshot cutoffs.
  created_at = now(),
  updated_at = now();

-- name: ClaimReconcileWorkItems :many
-- Claim scope rows (single-flight by unique scope key), then return all payloads
-- currently attached to each claimed scope as one aggregated item.
WITH candidate_scopes AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.not_before <= now()
    AND (s.claimed_until IS NULL OR s.claimed_until < now())
  ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC
  LIMIT sqlc.arg(batch_size)
  FOR UPDATE OF s SKIP LOCKED
), claimed_scopes AS (
  UPDATE reconcile_work_scope AS s
  SET
    claimed_by = sqlc.arg(claimed_by),
    claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
    updated_at = now()
  FROM candidate_scopes AS c
  WHERE s.id = c.id
  RETURNING s.*
)
SELECT
  s.id,
  s.workspace_id,
  s.kind,
  s.scope_type,
  s.scope_id,
  s.event_ts,
  s.priority,
  s.not_before,
  COALESCE(MAX(p.attempt_count), 0)::int AS attempt_count,
  COALESCE(MAX(p.last_error), '')::text AS last_error,
  COALESCE(s.claimed_by, '')::text AS claimed_by,
  s.claimed_until,
  s.updated_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', p.payload_type,
        'key', p.payload_key,
        'payload', p.payload
      )
      ORDER BY p.created_at ASC, p.id ASC
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::jsonb
  )::jsonb AS payloads
FROM claimed_scopes AS s
LEFT JOIN reconcile_work_payload AS p
  ON p.scope_ref = s.id
GROUP BY
  s.id,
  s.workspace_id,
  s.kind,
  s.scope_type,
  s.scope_id,
  s.event_ts,
  s.priority,
  s.not_before,
  s.claimed_by,
  s.claimed_until,
  s.updated_at
ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC;

-- name: ClaimReconcileWorkItemsByKinds :many
-- Same as ClaimReconcileWorkItems, but constrained to selected kinds.
WITH candidate_scopes AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.not_before <= now()
    AND (s.claimed_until IS NULL OR s.claimed_until < now())
    AND s.kind = ANY(sqlc.arg(kinds)::text[])
  ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC
  LIMIT sqlc.arg(batch_size)
  FOR UPDATE OF s SKIP LOCKED
), claimed_scopes AS (
  UPDATE reconcile_work_scope AS s
  SET
    claimed_by = sqlc.arg(claimed_by),
    claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
    updated_at = now()
  FROM candidate_scopes AS c
  WHERE s.id = c.id
  RETURNING s.*
)
SELECT
  s.id,
  s.workspace_id,
  s.kind,
  s.scope_type,
  s.scope_id,
  s.event_ts,
  s.priority,
  s.not_before,
  COALESCE(MAX(p.attempt_count), 0)::int AS attempt_count,
  COALESCE(MAX(p.last_error), '')::text AS last_error,
  COALESCE(s.claimed_by, '')::text AS claimed_by,
  s.claimed_until,
  s.updated_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', p.payload_type,
        'key', p.payload_key,
        'payload', p.payload
      )
      ORDER BY p.created_at ASC, p.id ASC
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::jsonb
  )::jsonb AS payloads
FROM claimed_scopes AS s
LEFT JOIN reconcile_work_payload AS p
  ON p.scope_ref = s.id
GROUP BY
  s.id,
  s.workspace_id,
  s.kind,
  s.scope_type,
  s.scope_id,
  s.event_ts,
  s.priority,
  s.not_before,
  s.claimed_by,
  s.claimed_until,
  s.updated_at
ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC;

-- name: ExtendReconcileWorkItemLease :execrows
-- Lease extension is scope-level in the two-table design.
UPDATE reconcile_work_scope
SET
  claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: DeleteClaimedReconcileWorkItemIfUnchanged :one
-- Delete payloads that existed when the worker claimed this scope
-- (p.created_at <= claimed scope updated_at). Newer payload upserts are preserved.
WITH target_scope AS (
  SELECT s.id, s.updated_at
  FROM reconcile_work_scope AS s
  WHERE s.id = sqlc.arg(id)
    AND s.claimed_by = sqlc.arg(claimed_by)
    AND s.updated_at <= sqlc.arg(updated_at)
), deleted_payloads AS (
  DELETE FROM reconcile_work_payload AS p
  USING target_scope AS t
  WHERE p.scope_ref = t.id
    AND p.created_at <= t.updated_at
  RETURNING p.id
), remaining_payloads AS (
  SELECT
    t.id AS scope_ref,
    EXISTS (
      SELECT 1
      FROM reconcile_work_payload AS p
      WHERE p.scope_ref = t.id
        AND NOT EXISTS (
          SELECT 1
          FROM deleted_payloads AS d
          WHERE d.id = p.id
        )
    ) AS has_remaining
  FROM target_scope AS t
), dropped_scope AS (
  DELETE FROM reconcile_work_scope AS s
  USING remaining_payloads AS r
  WHERE s.id = r.scope_ref
    AND NOT r.has_remaining
  RETURNING s.id
), released_scope AS (
  UPDATE reconcile_work_scope AS s
  SET
    claimed_by = NULL,
    claimed_until = NULL,
    updated_at = now()
  FROM remaining_payloads AS r
  WHERE s.id = r.scope_ref
    AND r.has_remaining
  RETURNING s.id
)
SELECT
  COUNT(*)::int AS deleted_payload_count,
  EXISTS (SELECT 1 FROM target_scope) AS owned,
  EXISTS (SELECT 1 FROM dropped_scope) AS scope_deleted
FROM deleted_payloads;

-- name: ReleaseReconcileWorkItemClaim :execrows
-- Release the scope claim without deleting payloads.
UPDATE reconcile_work_scope
SET
  claimed_by = NULL,
  claimed_until = NULL,
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: RetryReconcileWorkItem :one
-- Retry only payloads that were part of the claimed snapshot, then set
-- scope backoff and release claim.
WITH target_scope AS (
  SELECT s.id, s.updated_at
  FROM reconcile_work_scope AS s
  WHERE s.id = sqlc.arg(id)
    AND s.claimed_by = sqlc.arg(claimed_by)
), updated_payloads AS (
  UPDATE reconcile_work_payload AS p
  SET
    attempt_count = p.attempt_count + 1,
    last_error = sqlc.arg(last_error),
    updated_at = now()
  FROM target_scope AS t
  WHERE p.scope_ref = t.id
    AND p.created_at <= t.updated_at
  RETURNING p.id
), released_scope AS (
  UPDATE reconcile_work_scope AS s
  SET
    not_before = now() + make_interval(secs => sqlc.arg(retry_backoff_seconds)::int),
    claimed_by = NULL,
    claimed_until = NULL,
    updated_at = now()
  FROM target_scope AS t
  WHERE s.id = t.id
  RETURNING s.id
)
SELECT
  COUNT(*)::int AS retried_payload_count,
  EXISTS (SELECT 1 FROM target_scope) AS owned,
  EXISTS (SELECT 1 FROM released_scope) AS scope_released
FROM updated_payloads;
