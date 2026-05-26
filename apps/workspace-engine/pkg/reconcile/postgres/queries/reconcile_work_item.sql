-- name: BatchUpsertReconcileWorkScopes :exec
-- Batch upsert scope rows for multiple work items in a single round-trip.
-- Rows that are currently claimed (being processed) are skipped entirely to
-- avoid row-lock contention with the claim holder.
INSERT INTO reconcile_work_scope (
  workspace_id, kind, scope_type, scope_id, event_ts, priority, not_before,
  claimed_by, claimed_until, created_at, updated_at
)
SELECT
  unnest(sqlc.arg(workspace_ids)::uuid[]),
  unnest(sqlc.arg(kinds)::text[]),
  unnest(sqlc.arg(scope_types)::text[]),
  unnest(sqlc.arg(scope_ids)::text[]),
  unnest(sqlc.arg(event_ts)::timestamptz[]),
  unnest(sqlc.arg(priorities)::smallint[]),
  unnest(sqlc.arg(not_befores)::timestamptz[]),
  NULL, NULL, now(), now()
ON CONFLICT (workspace_id, kind, scope_type, scope_id)
DO UPDATE SET
  event_ts   = GREATEST(reconcile_work_scope.event_ts, EXCLUDED.event_ts),
  priority   = LEAST(reconcile_work_scope.priority, EXCLUDED.priority),
  not_before = LEAST(reconcile_work_scope.not_before, EXCLUDED.not_before),
  updated_at = now()
WHERE reconcile_work_scope.claimed_until IS NULL
   OR reconcile_work_scope.claimed_until < now();

-- name: UpsertReconcileWorkItem :exec
-- Upsert scope scheduling metadata. Skips rows that are currently claimed
-- to avoid row-lock contention with the claim holder.
INSERT INTO reconcile_work_scope (
  workspace_id, kind, scope_type, scope_id, event_ts, priority, not_before,
  claimed_by, claimed_until, created_at, updated_at
) VALUES (
  sqlc.arg(workspace_id), sqlc.arg(kind), sqlc.arg(scope_type), sqlc.arg(scope_id), sqlc.arg(event_ts), sqlc.arg(priority), sqlc.arg(not_before),
  NULL, NULL, now(), now()
)
ON CONFLICT (workspace_id, kind, scope_type, scope_id)
DO UPDATE SET
  event_ts   = GREATEST(reconcile_work_scope.event_ts, EXCLUDED.event_ts),
  priority   = LEAST(reconcile_work_scope.priority, EXCLUDED.priority),
  not_before = LEAST(reconcile_work_scope.not_before, EXCLUDED.not_before),
  updated_at = now()
WHERE reconcile_work_scope.claimed_until IS NULL;

-- name: ClaimReconcileWorkItems :many
-- Claim unclaimed scope rows, ordered by priority then event time.
WITH candidate_scopes AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.not_before <= now()
    AND s.claimed_until IS NULL
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
  s.attempt_count,
  COALESCE(s.last_error, '')::text AS last_error,
  COALESCE(s.claimed_by, '')::text AS claimed_by,
  s.claimed_until,
  s.updated_at
FROM claimed_scopes AS s
ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC;

-- name: ClaimReconcileWorkItemsByKinds :many
-- Same as ClaimReconcileWorkItems, but constrained to selected kinds.
WITH candidate_scopes AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.not_before <= now()
    AND s.claimed_until IS NULL
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
  s.attempt_count,
  COALESCE(s.last_error, '')::text AS last_error,
  COALESCE(s.claimed_by, '')::text AS claimed_by,
  s.claimed_until,
  s.updated_at
FROM claimed_scopes AS s
ORDER BY s.priority ASC, s.event_ts ASC, s.id ASC;

-- name: ExtendReconcileWorkItemLease :execrows
UPDATE reconcile_work_scope
SET
  claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: DeleteClaimedReconcileWorkItem :one
-- Delete the scope row if it is still owned by the caller. Ownership is
-- the only invariant we check; a prior version also required updated_at to
-- match the claim snapshot, but our own lease heartbeat advances updated_at
-- mid-processing, so that guard silently broke deletion for any item whose
-- processing exceeded one heartbeat tick.
--
-- claimed_by is re-checked inside the DELETE row-lock (not just on the
-- target_scope snapshot) to close a race where the lease could expire,
-- claim_cleanup releases, and another worker claims the row between the
-- CTE snapshot read and the row-lock acquisition.
WITH target_scope AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.id = sqlc.arg(id)
    AND s.claimed_by = sqlc.arg(claimed_by)
), deleted_scope AS (
  DELETE FROM reconcile_work_scope AS s
  USING target_scope AS t
  WHERE s.id = t.id
    AND s.claimed_by = sqlc.arg(claimed_by)
  RETURNING s.id
)
SELECT
  EXISTS (SELECT 1 FROM target_scope) AS owned,
  EXISTS (SELECT 1 FROM deleted_scope) AS deleted;

-- name: ReleaseReconcileWorkItemClaim :execrows
UPDATE reconcile_work_scope
SET
  claimed_by = NULL,
  claimed_until = NULL,
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: CleanupExpiredClaims :execrows
-- Release a batch of scopes whose lease has expired so they become claimable
-- again. Uses LIMIT + FOR UPDATE SKIP LOCKED to cap lock contention.
WITH expired AS (
  SELECT id
  FROM reconcile_work_scope
  WHERE claimed_until IS NOT NULL
    AND claimed_until < now()
  LIMIT 500
  FOR UPDATE SKIP LOCKED
)
UPDATE reconcile_work_scope AS s
SET
  claimed_by = NULL,
  claimed_until = NULL,
  updated_at = now()
FROM expired AS e
WHERE s.id = e.id;

-- name: AckPermanentlyFailedReconcileWorkItem :one
-- Delete a permanently-failed work item owned by the caller. Diagnostic state
-- for the failure is captured via the reconcile.queue.permanent_failures
-- counter (tagged by kind / error_type / cause) — durable per-item diagnostics
-- will live in a future dead-letter table; for now the row is removed so it
-- stops cycling through the queue.
WITH target_scope AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.id = sqlc.arg(id)
    AND s.claimed_by = sqlc.arg(claimed_by)
), deleted_scope AS (
  DELETE FROM reconcile_work_scope AS s
  USING target_scope AS t
  WHERE s.id = t.id
  RETURNING s.id
)
SELECT
  EXISTS (SELECT 1 FROM target_scope) AS owned,
  EXISTS (SELECT 1 FROM deleted_scope) AS deleted;

-- name: RetryReconcileWorkItem :one
-- Increment attempt count, record error, set backoff, and release claim.
WITH target_scope AS (
  SELECT s.id
  FROM reconcile_work_scope AS s
  WHERE s.id = sqlc.arg(id)
    AND s.claimed_by = sqlc.arg(claimed_by)
), released_scope AS (
  UPDATE reconcile_work_scope AS s
  SET
    attempt_count = s.attempt_count + 1,
    last_error = sqlc.arg(last_error),
    not_before = now() + make_interval(secs => sqlc.arg(retry_backoff_seconds)::int),
    claimed_by = NULL,
    claimed_until = NULL,
    updated_at = now()
  FROM target_scope AS t
  WHERE s.id = t.id
  RETURNING s.id
)
SELECT
  EXISTS (SELECT 1 FROM target_scope) AS owned,
  EXISTS (SELECT 1 FROM released_scope) AS released;