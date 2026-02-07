package db

import (
	"context"
	"encoding/json"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const JOB_SELECT_QUERY = `
	SELECT
		j.completed_at,
		j.created_at,
		j.external_id,
		j.id,
		j.job_agent_config,
		j.job_agent_id,
		rj.release_id,
		j.started_at,
		j.status,
		j.updated_at,
		COALESCE(
			json_object_agg(
				COALESCE(jm.key, ''), 
				COALESCE(jm.value, '')
			) FILTER (WHERE jm.key IS NOT NULL), 
			'{}'::json
		) as metadata
	FROM job j
	INNER JOIN release_job rj ON rj.job_id = j.id
	INNER JOIN release r ON r.id = rj.release_id
	INNER JOIN version_release vr ON vr.id = r.version_release_id
	INNER JOIN release_target rt ON rt.id = vr.release_target_id
	INNER JOIN resource res ON res.id = rt.resource_id
	LEFT JOIN job_metadata jm ON jm.job_id = j.id
	WHERE res.workspace_id = $1
	GROUP BY j.id, j.completed_at, j.created_at, j.external_id, j.job_agent_id, rj.release_id, j.started_at, j.status, j.updated_at
`

func getJobs(ctx context.Context, workspaceID string) ([]*oapi.Job, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, JOB_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]*oapi.Job, 0)
	for rows.Next() {
		job, err := scanJobRow(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return jobs, nil
}

func convertJobStatusToEnum(statusStr string) oapi.JobStatus {
	switch statusStr {
	case "pending":
		return oapi.JobStatusPending
	case "in_progress":
		return oapi.JobStatusInProgress
	case "successful":
		return oapi.JobStatusSuccessful
	case "cancelled":
		return oapi.JobStatusCancelled
	case "skipped":
		return oapi.JobStatusSkipped
	case "failure":
		return oapi.JobStatusFailure
	case "action_required":
		return oapi.JobStatusActionRequired
	case "invalid_job_agent":
		return oapi.JobStatusInvalidJobAgent
	case "invalid_integration":
		return oapi.JobStatusInvalidIntegration
	case "external_run_not_found":
		return oapi.JobStatusExternalRunNotFound
	}
	return oapi.JobStatusPending // default to pending
}

func scanJobRow(rows pgx.Rows) (*oapi.Job, error) {
	job := &oapi.Job{}
	var startedAt, completedAt *time.Time
	var createdAt, updatedAt time.Time
	var statusStr string
	var metadataJSON []byte
	err := rows.Scan(
		&completedAt,
		&createdAt,
		&job.ExternalId,
		&job.Id,
		&job.JobAgentConfig,
		&job.JobAgentId,
		&job.ReleaseId,
		&startedAt,
		&statusStr,
		&updatedAt,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	job.CreatedAt = createdAt
	job.UpdatedAt = updatedAt
	job.StartedAt = startedAt
	job.CompletedAt = completedAt

	job.Status = convertJobStatusToEnum(statusStr)

	if err := setJobMetadata(job, metadataJSON); err != nil {
		return nil, err
	}

	return job, nil
}

func setJobMetadata(job *oapi.Job, metadataJSON []byte) error {
	job.Metadata = make(map[string]string)

	if len(metadataJSON) == 0 {
		return nil
	}

	var metadataMap map[string]string
	if err := json.Unmarshal(metadataJSON, &metadataMap); err != nil {
		return err
	}

	if len(metadataMap) > 0 {
		job.Metadata = metadataMap
	}
	return nil
}

