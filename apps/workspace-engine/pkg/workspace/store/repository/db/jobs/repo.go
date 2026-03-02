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
		log.Warn("Failed to parse job id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetJobByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(fromGetRow(row)), true
}

func (r *Repo) Set(entity *oapi.Job) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	queries := db.GetQueries(r.ctx)

	if err := queries.UpsertJob(r.ctx, params); err != nil {
		return fmt.Errorf("upsert job: %w", err)
	}

	jobID := params.ID

	if entity.ReleaseId != "" {
		releaseID, err := uuid.Parse(entity.ReleaseId)
		if err == nil {
			_ = queries.InsertReleaseJob(r.ctx, db.InsertReleaseJobParams{
				ReleaseID: releaseID,
				JobID:     jobID,
			})
		}
	}

	if err := queries.DeleteJobMetadataByJobID(r.ctx, jobID); err != nil {
		return fmt.Errorf("delete old metadata: %w", err)
	}
	for k, v := range entity.Metadata {
		if err := queries.UpsertJobMetadata(r.ctx, db.UpsertJobMetadataParams{
			JobID: jobID,
			Key:   k,
			Value: v,
		}); err != nil {
			return fmt.Errorf("upsert metadata key %q: %w", k, err)
		}
	}

	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}
	return db.GetQueries(r.ctx).DeleteJobByID(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Job {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Job)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list jobs by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Job)
	}

	result := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		j := ToOapi(fromWorkspaceRow(row))
		result[j.Id] = j
	}
	return result
}

func (r *Repo) GetByAgentID(agentID string) ([]*oapi.Job, error) {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return nil, fmt.Errorf("parse agent id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListJobsByAgentID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list jobs by agent: %w", err)
	}

	result := make([]*oapi.Job, 0, len(rows))
	for _, row := range rows {
		result = append(result, ToOapi(fromAgentRow(row)))
	}
	return result, nil
}
