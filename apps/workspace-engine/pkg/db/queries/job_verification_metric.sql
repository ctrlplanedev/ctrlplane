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

-- name: GetProviderContextForMetric :one
SELECT
  r.id            AS release_id,
  r.created_at    AS release_created_at,
  res.id          AS resource_id,
  res.name        AS resource_name,
  res.kind        AS resource_kind,
  res.identifier  AS resource_identifier,
  res.version     AS resource_version,
  res.config      AS resource_config,
  res.metadata    AS resource_metadata,
  env.id          AS environment_id,
  env.name        AS environment_name,
  env.metadata    AS environment_metadata,
  dep.id          AS deployment_id,
  dep.name        AS deployment_name,
  dep.description AS deployment_description,
  dep.metadata    AS deployment_metadata,
  dv.id           AS version_id,
  dv.name         AS version_name,
  dv.tag          AS version_tag,
  dv.config       AS version_config,
  dv.metadata     AS version_metadata,
  COALESCE(
    (SELECT json_agg(json_build_object('key', rv.key, 'value', rv.value, 'encrypted', rv.encrypted))
     FROM release_variable rv WHERE rv.release_id = r.id),
    '[]'
  )::jsonb AS release_variables
FROM job_verification_metric jvm
JOIN release_job rj ON rj.job_id = jvm.job_id
JOIN release r ON r.id = rj.release_id
JOIN resource res ON res.id = r.resource_id
JOIN environment env ON env.id = r.environment_id
JOIN deployment dep ON dep.id = r.deployment_id
JOIN deployment_version dv ON dv.id = r.version_id
WHERE jvm.id = $1;
