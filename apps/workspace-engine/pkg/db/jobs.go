package db

import (
	"context"
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
		j.updated_at
	FROM job j
	INNER JOIN release_job rj ON rj.job_id = j.id
	INNER JOIN release r ON r.id = rj.release_id
	INNER JOIN version_release vr ON vr.id = r.version_release_id
	INNER JOIN release_target rt ON rt.id = vr.release_target_id
	INNER JOIN resource res ON res.id = rt.resource_id
	WHERE res.workspace_id = $1
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
		return oapi.Pending
	case "in_progress":
		return oapi.InProgress
	case "successful":
		return oapi.Successful
	case "cancelled":
		return oapi.Cancelled
	case "skipped":
		return oapi.Skipped
	case "failure":
		return oapi.Failure
	case "action_required":
		return oapi.ActionRequired
	case "invalid_job_agent":
		return oapi.InvalidJobAgent
	case "invalid_integration":
		return oapi.InvalidIntegration
	case "external_run_not_found":
		return oapi.ExternalRunNotFound
	}
	return oapi.Pending // default to pending
}

func scanJobRow(rows pgx.Rows) (*oapi.Job, error) {
	job := &oapi.Job{}
	var startedAt, completedAt *time.Time
	var createdAt, updatedAt time.Time
	var statusStr string
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
	)
	if err != nil {
		return nil, err
	}

	job.CreatedAt = createdAt
	job.UpdatedAt = updatedAt
	job.StartedAt = startedAt
	job.CompletedAt = completedAt

	job.Status = convertJobStatusToEnum(statusStr)

	return job, nil
}

const JOB_UPSERT_QUERY = `
	INSERT INTO job (id, job_agent_id, job_agent_config, external_id, status, created_at, started_at, completed_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	ON CONFLICT (id) DO UPDATE SET
		job_agent_id = EXCLUDED.job_agent_id,
		job_agent_config = EXCLUDED.job_agent_config,
		external_id = EXCLUDED.external_id,
		status = EXCLUDED.status,
		created_at = EXCLUDED.created_at,
		started_at = EXCLUDED.started_at,
		completed_at = EXCLUDED.completed_at,
		updated_at = EXCLUDED.updated_at
`

func convertOapiJobStatusToStr(status oapi.JobStatus) string {
	switch status {
	case oapi.Pending:
		return "pending"
	case oapi.InProgress:
		return "in_progress"
	case oapi.Successful:
		return "successful"
	case oapi.Cancelled:
		return "cancelled"
	case oapi.Skipped:
		return "skipped"
	case oapi.Failure:
		return "failure"
	case oapi.ActionRequired:
		return "action_required"
	case oapi.InvalidJobAgent:
		return "invalid_job_agent"
	case oapi.InvalidIntegration:
		return "invalid_integration"
	case oapi.ExternalRunNotFound:
		return "external_run_not_found"
	default:
		return "pending"
	}
}

func writeJob(ctx context.Context, job *oapi.Job, tx pgx.Tx) error {
	statusStr := convertOapiJobStatusToStr(job.Status)
	_, err := tx.Exec(
		ctx,
		JOB_UPSERT_QUERY,
		job.Id,
		job.JobAgentId,
		job.JobAgentConfig,
		job.ExternalId,
		statusStr,
		job.CreatedAt,
		job.StartedAt,
		job.CompletedAt,
		job.UpdatedAt)
	return err
}

const DELETE_JOB_QUERY = `
	DELETE FROM job WHERE id = $1
`

func deleteJob(ctx context.Context, jobId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_JOB_QUERY, jobId); err != nil {
		return err
	}
	return nil
}
