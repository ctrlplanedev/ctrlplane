package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

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
	if len(metadataJSON) == 0 {
		return nil
	}

	var metadataMap map[string]string
	if err := json.Unmarshal(metadataJSON, &metadataMap); err != nil {
		return err
	}

	// Only set metadata if it's not empty
	if len(metadataMap) > 0 {
		job.Metadata = &metadataMap
	}
	return nil
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

const RELEASE_JOB_CHECK_QUERY = `
	SELECT EXISTS(SELECT 1 FROM release_job WHERE release_id = $1 AND job_id = $2)
`

const RELEASE_JOB_INSERT_QUERY = `
	INSERT INTO release_job (release_id, job_id)
	VALUES ($1, $2)
`

func writeReleaseJob(ctx context.Context, releaseId string, jobId string, tx pgx.Tx) error {
	var exists bool
	err := tx.QueryRow(ctx, RELEASE_JOB_CHECK_QUERY, releaseId, jobId).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = tx.Exec(ctx, RELEASE_JOB_INSERT_QUERY, releaseId, jobId)
	return err
}

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

func writeJob(ctx context.Context, job *oapi.Job, store *store.Store, tx pgx.Tx) error {
	release, ok := store.Releases.Get(job.ReleaseId)
	if !ok {
		return fmt.Errorf("release not found for job %s", job.Id)
	}
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
	if err != nil {
		return err
	}

	if job.ReleaseId != "" {
		if err := writeReleaseJob(ctx, release.UUID().String(), job.Id, tx); err != nil {
			return err
		}
	}

	// Handle metadata
	if _, err := tx.Exec(ctx, "DELETE FROM job_metadata WHERE job_id = $1", job.Id); err != nil {
		return fmt.Errorf("failed to delete existing job metadata: %w", err)
	}

	if job.Metadata != nil && len(*job.Metadata) > 0 {
		if err := writeJobMetadata(ctx, job.Id, *job.Metadata, tx); err != nil {
			return err
		}
	}

	return nil
}

func writeJobMetadata(ctx context.Context, jobId string, metadata map[string]string, tx pgx.Tx) error {
	if len(metadata) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(metadata))
	valueArgs := make([]interface{}, 0, len(metadata)*3)
	i := 1
	for k, v := range metadata {
		valueStrings = append(valueStrings,
			"($"+fmt.Sprintf("%d", i)+", $"+fmt.Sprintf("%d", i+1)+", $"+fmt.Sprintf("%d", i+2)+")",
		)
		valueArgs = append(valueArgs, jobId, k, v)
		i += 3
	}

	query := "INSERT INTO job_metadata (job_id, key, value) VALUES " +
		strings.Join(valueStrings, ", ") +
		" ON CONFLICT (job_id, key) DO UPDATE SET value = EXCLUDED.value"

	_, err := tx.Exec(ctx, query, valueArgs...)
	if err != nil {
		return err
	}
	return nil
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
