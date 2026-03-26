-- name: ListReleaseTargetsByDeploymentID :many
SELECT DISTINCT ON (d.id, r.id, e.id)
  d.id AS deployment_id,
  r.id AS resource_id,
  r.name AS resource_name,
  r.version AS resource_version,
  r.kind AS resource_kind,
  r.identifier AS resource_identifier,
  e.id AS environment_id,
  e.name AS environment_name,
  dv.id AS desired_version_id,
  dv.name AS desired_version_name,
  dv.tag AS desired_version_tag
FROM computed_deployment_resource cdr
INNER JOIN deployment d
  ON cdr.deployment_id = d.id
INNER JOIN resource r
  ON cdr.resource_id = r.id
INNER JOIN system_deployment sd
  ON cdr.deployment_id = sd.deployment_id
INNER JOIN system_environment se
  ON sd.system_id = se.system_id
INNER JOIN environment e
  ON se.environment_id = e.id
INNER JOIN computed_environment_resource cer
  ON cer.environment_id = e.id
  AND cer.resource_id = r.id
LEFT JOIN release_target_desired_release rtdr
  ON rtdr.deployment_id = d.id
  AND rtdr.resource_id = r.id
  AND rtdr.environment_id = e.id
LEFT JOIN release rel
  ON rtdr.desired_release_id = rel.id
LEFT JOIN deployment_version dv
  ON rel.version_id = dv.id
WHERE d.id = $1
ORDER BY d.id, r.id, e.id;

-- name: ListLatestJobsByDeploymentID :many
SELECT DISTINCT ON (rel.resource_id, rel.environment_id, rel.deployment_id)
  rel.resource_id,
  rel.environment_id,
  rel.deployment_id,
  j.id AS job_id,
  j.status AS job_status,
  j.message AS job_message,
  j.created_at AS job_created_at,
  j.completed_at AS job_completed_at,
  COALESCE(
    (SELECT json_object_agg(m.key, m.value)
     FROM job_metadata m WHERE m.job_id = j.id),
    '{}'
  )::jsonb AS job_metadata
FROM release rel
INNER JOIN release_job rj
  ON rel.id = rj.release_id
INNER JOIN job j
  ON rj.job_id = j.id
WHERE rel.deployment_id = $1
ORDER BY rel.resource_id, rel.environment_id, rel.deployment_id, j.created_at DESC;

-- name: ListCurrentVersionsByDeploymentID :many
SELECT DISTINCT ON (rel.resource_id, rel.environment_id, rel.deployment_id)
  rel.resource_id,
  rel.environment_id,
  rel.deployment_id,
  dv.id AS version_id,
  dv.name AS version_name,
  dv.tag AS version_tag
FROM release rel
INNER JOIN release_job rj
  ON rel.id = rj.release_id
INNER JOIN job j
  ON rj.job_id = j.id
  AND j.status = 'successful'
INNER JOIN deployment_version dv
  ON rel.version_id = dv.id
WHERE rel.deployment_id = $1
ORDER BY rel.resource_id, rel.environment_id, rel.deployment_id, j.completed_at DESC NULLS LAST;

-- name: ListVerificationMetricsByJobIDs :many
SELECT
  jvm.id AS metric_id,
  jvm.job_id AS metric_job_id,
  jvm.policy_rule_verification_metric_id AS metric_policy_rule_id,
  jvm.name AS metric_name,
  jvm.provider AS metric_provider,
  jvm.count AS metric_count,
  jvm.success_condition AS metric_success_condition,
  jvm.success_threshold AS metric_success_threshold,
  jvm.failure_condition AS metric_failure_condition,
  jvm.failure_threshold AS metric_failure_threshold
FROM job_verification_metric jvm
WHERE jvm.job_id = ANY(@job_ids::uuid[])
ORDER BY jvm.job_id, jvm.id;
