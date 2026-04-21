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
    OR (
      COALESCE(m.success_threshold, 0) > 0
      AND COALESCE(cp.consecutive_passes, 0) >= m.success_threshold
    )
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
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS consecutive_passes
  FROM job_verification_metric_measurement mm
  WHERE mm.job_verification_metric_status_id = m.id
    AND mm.status = 'passed'
    AND mm.measured_at > COALESCE(
      (SELECT MAX(measured_at)
       FROM job_verification_metric_measurement
       WHERE job_verification_metric_status_id = m.id
         AND status <> 'passed'),
      '-infinity'::timestamptz
    )
) cp ON true
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

-- name: GetAggregateJobVerificationStatus :one
-- Returns the aggregate verification status for a job:
-- 'passed' if all metrics have completed (either by reaching count, hitting the success_threshold
--          consecutive-pass early-termination, or by exhausting count without exceeding failure_threshold),
-- 'running' if any metric is still incomplete,
-- 'failed' if any metric has exceeded its failure threshold.
-- Returns '' (empty string) if the job has no verification metrics.
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN ''
    WHEN bool_or(COALESCE(mc.failures, 0) > COALESCE(jvm.failure_threshold, 0)) THEN 'failed'
    WHEN bool_or(
      COALESCE(mc.total, 0) < jvm.count
      AND COALESCE(mc.failures, 0) <= COALESCE(jvm.failure_threshold, 0)
      AND NOT (
        COALESCE(jvm.success_threshold, 0) > 0
        AND COALESCE(cp.consecutive_passes, 0) >= jvm.success_threshold
      )
    ) THEN 'running'
    ELSE 'passed'
  END::text AS status
FROM job_verification_metric jvm
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE mm.status = 'failed')::int AS failures
  FROM job_verification_metric_measurement mm
  WHERE mm.job_verification_metric_status_id = jvm.id
) mc ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS consecutive_passes
  FROM job_verification_metric_measurement mm
  WHERE mm.job_verification_metric_status_id = jvm.id
    AND mm.status = 'passed'
    AND mm.measured_at > COALESCE(
      (SELECT MAX(measured_at)
       FROM job_verification_metric_measurement
       WHERE job_verification_metric_status_id = jvm.id
         AND status <> 'passed'),
      '-infinity'::timestamptz
    )
) cp ON true
WHERE jvm.job_id = @job_id;

-- name: GetJobVerificationsWithMeasurements :many
-- Returns all verification metrics for a job, with measurements as JSON.
SELECT
  jvm.id,
  jvm.created_at,
  jvm.job_id,
  jvm.policy_rule_verification_metric_id,
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
FROM job_verification_metric jvm
WHERE jvm.job_id = @job_id
ORDER BY jvm.id;

-- name: ListVerificationMetricsWithMeasurementsByJobIDs :many
-- Returns verification metrics with their individual measurement statuses for a batch of jobs.
-- Used to compute verification status in Go via JobVerification.Status().
SELECT
  jvm.job_id,
  jvm.id AS metric_id,
  jvm.count,
  jvm.failure_threshold,
  jvm.success_threshold,
  mm.status AS measurement_status
FROM job_verification_metric jvm
LEFT JOIN job_verification_metric_measurement mm
  ON mm.job_verification_metric_status_id = jvm.id
WHERE jvm.job_id = ANY(@job_ids::uuid[])
ORDER BY jvm.job_id, jvm.id, mm.measured_at ASC;

-- name: GetJobDispatchContext :one
SELECT j.dispatch_context
FROM job j
JOIN job_verification_metric jvm ON j.id = jvm.job_id
WHERE jvm.id = $1;
