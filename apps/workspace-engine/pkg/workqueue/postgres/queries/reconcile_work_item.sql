-- name: UpsertReconcileWorkItem :exec
INSERT INTO reconcile_work_item (
  workspace_id, kind, scope_type, scope_id, event_ts, priority, not_before,
  attempt_count, last_error, claimed_by, claimed_until, created_at, updated_at
) VALUES (
  sqlc.arg(workspace_id), sqlc.arg(kind), sqlc.arg(scope_type), sqlc.arg(scope_id), sqlc.arg(event_ts), sqlc.arg(priority), sqlc.arg(not_before), 0, NULL, NULL, NULL, now(), now()
)
ON CONFLICT (workspace_id, kind, scope_type, scope_id)
DO UPDATE SET
  event_ts = GREATEST(reconcile_work_item.event_ts, EXCLUDED.event_ts),
  priority = LEAST(reconcile_work_item.priority, EXCLUDED.priority),
  not_before = LEAST(reconcile_work_item.not_before, EXCLUDED.not_before),
  updated_at = now(),
  last_error = NULL,
  claimed_by = CASE
    WHEN reconcile_work_item.claimed_until IS NOT NULL
      AND reconcile_work_item.claimed_until < now()
    THEN NULL
    ELSE reconcile_work_item.claimed_by
  END,
  claimed_until = CASE
    WHEN reconcile_work_item.claimed_until IS NOT NULL
      AND reconcile_work_item.claimed_until < now()
    THEN NULL
    ELSE reconcile_work_item.claimed_until
  END;

-- name: ClaimReconcileWorkItems :many
WITH candidates AS (
  SELECT id
  FROM reconcile_work_item
  WHERE not_before <= now()
    AND (claimed_until IS NULL OR claimed_until < now())
  ORDER BY priority ASC, event_ts ASC, id ASC
  LIMIT sqlc.arg(batch_size)
  FOR UPDATE SKIP LOCKED
)
UPDATE reconcile_work_item AS w
SET
  claimed_by = sqlc.arg(claimed_by),
  claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
  updated_at = now()
FROM candidates AS c
WHERE w.id = c.id
RETURNING
  w.id,
  w.workspace_id,
  w.kind,
  w.scope_type,
  w.scope_id,
  w.event_ts,
  w.priority,
  w.not_before,
  w.attempt_count,
  COALESCE(w.last_error, '') AS last_error,
  COALESCE(w.claimed_by, '') AS claimed_by,
  w.claimed_until,
  w.updated_at;

-- name: ClaimReconcileWorkItemsByKinds :many
WITH candidates AS (
  SELECT id
  FROM reconcile_work_item
  WHERE not_before <= now()
    AND (claimed_until IS NULL OR claimed_until < now())
    AND kind = ANY(sqlc.arg(kinds)::text[])
  ORDER BY priority ASC, event_ts ASC, id ASC
  LIMIT sqlc.arg(batch_size)
  FOR UPDATE SKIP LOCKED
)
UPDATE reconcile_work_item AS w
SET
  claimed_by = sqlc.arg(claimed_by),
  claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
  updated_at = now()
FROM candidates AS c
WHERE w.id = c.id
RETURNING
  w.id,
  w.workspace_id,
  w.kind,
  w.scope_type,
  w.scope_id,
  w.event_ts,
  w.priority,
  w.not_before,
  w.attempt_count,
  COALESCE(w.last_error, '') AS last_error,
  COALESCE(w.claimed_by, '') AS claimed_by,
  w.claimed_until,
  w.updated_at;

-- name: ExtendReconcileWorkItemLease :execrows
UPDATE reconcile_work_item
SET
  claimed_until = now() + make_interval(secs => sqlc.arg(lease_seconds)::int),
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: DeleteClaimedReconcileWorkItemIfUnchanged :execrows
DELETE FROM reconcile_work_item
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by)
  AND updated_at <= sqlc.arg(updated_at);

-- name: ReleaseReconcileWorkItemClaim :execrows
UPDATE reconcile_work_item
SET
  claimed_by = NULL,
  claimed_until = NULL,
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);

-- name: RetryReconcileWorkItem :execrows
UPDATE reconcile_work_item
SET
  attempt_count = attempt_count + 1,
  last_error = sqlc.arg(last_error),
  not_before = now() + make_interval(secs => sqlc.arg(retry_backoff_seconds)::int),
  claimed_by = NULL,
  claimed_until = NULL,
  updated_at = now()
WHERE id = sqlc.arg(id)
  AND claimed_by = sqlc.arg(claimed_by);
