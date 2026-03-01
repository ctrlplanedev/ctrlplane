-- name: GetVerificationMetricWithMeasurements :one
SELECT
  jvm.id,
  jvm.created_at,
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
