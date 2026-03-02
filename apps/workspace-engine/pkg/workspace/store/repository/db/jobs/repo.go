package jobs

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.Job, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetJobByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	job, err := ToOapi(row)
	if err != nil {
		log.Warn("Failed to convert job", "id", id, "error", err)
		return nil, false
	}

	return job, true
}

func (r *Repo) Set(entity *oapi.Job) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertJob(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert job: %w", err)
	}

	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}
	return db.GetQueries(r.ctx).DeleteJob(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Job {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Job)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByWorkspaceID(r.ctx, db.ListJobsByWorkspaceIDParams{
		WorkspaceID: uid,
	})
	if err != nil {
		log.Warn("Failed to list jobs by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Job)
	}

	result := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		job, err := ToOapi(row)
		if err != nil {
			log.Warn("Failed to convert job", "job_id", row.ID, "error", err)
			continue
		}
		result[job.Id] = job
	}

	return result
}

func (r *Repo) GetByReleaseID(releaseID string) ([]*oapi.Job, error) {
	uid, err := uuid.Parse(releaseID)
	if err != nil {
		return nil, fmt.Errorf("parse release_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByReleaseID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list jobs by release: %w", err)
	}

	return r.convertRows(rows)
}

func (r *Repo) GetByJobAgentID(jobAgentID string) ([]*oapi.Job, error) {
	uid, err := uuid.Parse(jobAgentID)
	if err != nil {
		return nil, fmt.Errorf("parse job_agent_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByJobAgentID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list jobs by agent: %w", err)
	}

	return r.convertRows(rows)
}

func (r *Repo) GetByWorkflowJobID(workflowJobID string) ([]*oapi.Job, error) {
	uid, err := uuid.Parse(workflowJobID)
	if err != nil {
		return nil, fmt.Errorf("parse workflow_job_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByWorkflowJobID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list jobs by workflow job: %w", err)
	}

	return r.convertRows(rows)
}

func (r *Repo) GetByStatus(status oapi.JobStatus) ([]*oapi.Job, error) {
	dbStatus, ok := oapiToDBStatus[status]
	if !ok {
		return nil, fmt.Errorf("unknown job status: %s", status)
	}

	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByStatusAndWorkspace(r.ctx, db.ListJobsByStatusAndWorkspaceParams{
		Status:      dbStatus,
		WorkspaceID: uid,
	})
	if err != nil {
		return nil, fmt.Errorf("list jobs by status: %w", err)
	}

	return r.convertRows(rows)
}

func (r *Repo) convertRows(rows []db.Job) ([]*oapi.Job, error) {
	result := make([]*oapi.Job, 0, len(rows))
	for _, row := range rows {
		job, err := ToOapi(row)
		if err != nil {
			log.Warn("Failed to convert job", "job_id", row.ID, "error", err)
			continue
		}
		result = append(result, job)
	}
	return result, nil
}
