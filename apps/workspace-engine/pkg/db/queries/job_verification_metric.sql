-- name: GetVerificationMetricWithMeasurements :one
SELECT
  jvm.id,
  jvm.created_at,
  jvm.job_id,
  jvm.name,
  jvm.provider,
  jvm.interval_seconds,
  jvm.count,
  jvm.success_condition,
  jvm.success_threshold,
  jvm.failure_condition,
  jvm.failure_threshold,
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'id', mm.id,
        'metric_id', mm.job_verification_metric_status_id,
        'data', mm.data,
        'measured_at', mm.measured_at,
        'message', mm.message,
        'status', mm.status
      ) ORDER BY mm.measured_at ASC
    )
    FROM job_verification_metric_measurement mm
    WHERE mm.job_verification_metric_status_id = jvm.id),
    '[]'
  )::jsonb AS measurements
FROM
  job_verification_metric jvm
WHERE
  jvm.id = $1;

-- name: InsertJobVerificationMetric :one
INSERT INTO job_verification_metric (
  job_id, name, provider, interval_seconds, count,
  success_condition, success_threshold, failure_condition, failure_threshold
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: InsertJobVerificationMetricMeasurement :exec
INSERT INTO job_verification_metric_measurement (
  job_verification_metric_status_id, data, measured_at, message, status
) VALUES ($1, $2, $3, $4, $5);

-- name: GetSiblingMetricStatuses :many
SELECT
  m.id,
  (
    COALESCE(mc.total, 0) >= m.count
    OR COALESCE(mc.failures, 0) > COALESCE(m.failure_threshold, 0)
  )::boolean AS is_terminal,
  (COALESCE(mc.failures, 0) > COALESCE(m.failure_threshold, 0))::boolean AS is_failed
FROM job_verification_metric m
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE mm.status = 'failed')::int AS failures
  FROM job_verification_metric_measurement mm
  WHERE mm.job_verification_metric_status_id = m.id
) mc ON true
WHERE m.job_id = (SELECT job_id FROM job_verification_metric WHERE id = $1);

-- name: GetReleaseTargetForMetric :one
SELECT
  r.deployment_id,
  r.environment_id,
  r.resource_id,
  d.workspace_id
FROM job_verification_metric jvm
JOIN release_job rj ON rj.job_id = jvm.job_id
JOIN release r ON r.id = rj.release_id
JOIN deployment d ON d.id = r.deployment_id
WHERE jvm.id = $1;

-- name: GetJobDispatchContext :one
SELECT j.dispatch_context
FROM job j
JOIN job_verification_metric jvm ON j.id = jvm.job_id
WHERE jvm.id = $1;
