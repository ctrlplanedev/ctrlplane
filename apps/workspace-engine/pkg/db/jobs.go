package db

// import (
// 	"context"
// 	"time"
// 	"workspace-engine/pkg/pb"

// 	"github.com/jackc/pgx/v5"
// 	"google.golang.org/protobuf/types/known/structpb"
// )

// const JOB_SELECT_QUERY = `
// 	SELECT
// 		j.id,
// 		j.release_id,
// 		j.job_agent_id,
// 		j.job_agent_config,
// 		j.external_id,
// 		j.status,
// 		rt.resource_id,
// 		rt.environment_id,
// 		rt.deployment_id,
// 		j.created_at,
// 		j.updated_at,
// 		j.started_at,
// 		j.completed_at
// 	FROM job j
// 	INNER JOIN release_job rj ON rj.job_id = j.id
// 	INNER JOIN release r ON r.id = rj.release_id
// 	INNER JOIN version_release vr ON vr.id = r.version_release_id
// 	INNER JOIN release_target rt ON rt.id = vr.release_target_id
// 	INNER JOIN resource res ON res.id = rt.resource_id
// 	WHERE	res.workspace_id = $1
// `

// func getJobs(ctx context.Context, workspaceID string) ([]*pb.Job, error) {
// 	db, err := GetDB(ctx)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer db.Release()

// 	rows, err := db.Query(ctx, JOB_SELECT_QUERY, workspaceID)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer rows.Close()

// 	jobs := make([]*pb.Job, 0)
// 	for rows.Next() {
// 		job, err := scanJobRow(rows)
// 		if err != nil {
// 			return nil, err
// 		}
// 		jobs = append(jobs, job)
// 	}

// 	return jobs, nil
// }

// func scanJobRow(rows pgx.Rows) (*pb.Job, error) {
// 	var job pb.Job
// 	var jobAgentConfig *structpb.Struct
// 	var createdAt, updatedAt time.Time
// 	var startedAt, completedAt *time.Time

// 	err := rows.Scan(
// 		&job.Id,
// 		&job.ReleaseId,
// 		&job.JobAgentId,
// 		&jobAgentConfig,
// 		&job.ExternalId,
// 		&job.Status,
// 		&job.ResourceId,
// 		&job.EnvironmentId,
// 		&job.DeploymentId,
// 		&createdAt,
// 		&updatedAt,
// 		&startedAt,
// 		&completedAt,
// 	)
// 	if err != nil {
// 		return nil, err
// 	}

// 	job.CreatedAt = createdAt.Format(time.RFC3339)
// 	job.UpdatedAt = updatedAt.Format(time.RFC3339)
// 	if startedAt != nil {
// 		startedAtStr := startedAt.Format(time.RFC3339)
// 		job.StartedAt = &startedAtStr
// 	}
// 	if completedAt != nil {
// 		completedAtStr := completedAt.Format(time.RFC3339)
// 		job.CompletedAt = &completedAtStr
// 	}
// 	return &job, nil
// }
