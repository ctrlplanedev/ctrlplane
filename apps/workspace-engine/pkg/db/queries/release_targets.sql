-- name: ListReleaseTargetsByDeploymentID :many
SELECT DISTINCT ON (d.id, r.id, e.id)
  d.id AS deployment_id,
  d.name AS deployment_name,
  d.description AS deployment_description,
  d.resource_selector AS deployment_resource_selector,
  d.metadata AS deployment_metadata,
  d.workspace_id AS deployment_workspace_id,
  r.id AS resource_id,
  r.name AS resource_name,
  r.version AS resource_version,
  r.kind AS resource_kind,
  r.identifier AS resource_identifier,
  r.provider_id AS resource_provider_id,
  r.workspace_id AS resource_workspace_id,
  r.config AS resource_config,
  r.created_at AS resource_created_at,
  r.updated_at AS resource_updated_at,
  r.deleted_at AS resource_deleted_at,
  r.metadata AS resource_metadata,
  e.id AS environment_id,
  e.name AS environment_name,
  e.description AS environment_description,
  e.resource_selector AS environment_resource_selector,
  e.metadata AS environment_metadata,
  e.created_at AS environment_created_at,
  e.workspace_id AS environment_workspace_id,
  rel.id AS desired_release_id,
  rel.version_id AS desired_release_version_id,
  rel.created_at AS desired_release_created_at,
  dv.id AS desired_version_id,
  dv.name AS desired_version_name,
  dv.tag AS desired_version_tag,
  dv.config AS desired_version_config,
  dv.job_agent_config AS desired_version_job_agent_config,
  dv.deployment_id AS desired_version_deployment_id,
  dv.metadata AS desired_version_metadata,
  dv.status AS desired_version_status,
  dv.message AS desired_version_message,
  dv.created_at AS desired_version_created_at,
  j.id AS latest_job_id,
  j.status AS latest_job_status,
  j.message AS latest_job_message,
  j.reason AS latest_job_reason,
  j.created_at AS latest_job_created_at,
  j.started_at AS latest_job_started_at,
  j.completed_at AS latest_job_completed_at,
  j.updated_at AS latest_job_updated_at,
  j.external_id AS latest_job_external_id,
  j.job_agent_id AS latest_job_agent_id,
  j.job_agent_config AS latest_job_agent_config,
  j.dispatch_context AS latest_job_dispatch_context
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
LEFT JOIN release_job rj
  ON rel.id = rj.release_id
LEFT JOIN job j
  ON rj.job_id = j.id
WHERE d.id = $1
ORDER BY d.id, r.id, e.id, j.created_at DESC;

-- name: ListCurrentVersionsByDeploymentID :many
SELECT DISTINCT ON (rel.resource_id, rel.environment_id, rel.deployment_id)
  rel.resource_id,
  rel.environment_id,
  rel.deployment_id,
  dv.id AS version_id,
  dv.name AS version_name,
  dv.tag AS version_tag,
  dv.config AS version_config,
  dv.job_agent_config AS version_job_agent_config,
  dv.deployment_id AS version_deployment_id,
  dv.metadata AS version_metadata,
  dv.status AS version_status,
  dv.message AS version_message,
  dv.created_at AS version_created_at
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
  jvm.created_at AS metric_created_at,
  jvm.job_id AS metric_job_id,
  jvm.policy_rule_verification_metric_id AS metric_policy_rule_id,
  jvm.name AS metric_name,
  jvm.provider AS metric_provider,
  jvm.interval_seconds AS metric_interval_seconds,
  jvm.count AS metric_count,
  jvm.success_condition AS metric_success_condition,
  jvm.success_threshold AS metric_success_threshold,
  jvm.failure_condition AS metric_failure_condition,
  jvm.failure_threshold AS metric_failure_threshold,
  m.id AS measurement_id,
  m.job_verification_metric_status_id AS measurement_metric_id,
  m.data AS measurement_data,
  m.measured_at AS measurement_measured_at,
  m.message AS measurement_message,
  m.status AS measurement_status
FROM job_verification_metric jvm
LEFT JOIN job_verification_metric_measurement m
  ON m.job_verification_metric_status_id = jvm.id
WHERE jvm.job_id = ANY(@job_ids::uuid[])
ORDER BY jvm.job_id, jvm.id, m.measured_at;
