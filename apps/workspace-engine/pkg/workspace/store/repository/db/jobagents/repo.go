package jobagents

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.JobAgentRepo backed by the job_agent table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.JobAgent, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse job agent id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetJobAgentByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.JobAgent) error {
	entity.WorkspaceId = r.workspaceID
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertJobAgent(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert job agent: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteJobAgent(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.JobAgent {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.JobAgent)
	}

	rows, err := db.GetQueries(r.ctx).ListJobAgentsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list job agents by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.JobAgent)
	}

	result := make(map[string]*oapi.JobAgent, len(rows))
	for _, row := range rows {
		ja := ToOapi(row)
		result[ja.Id] = ja
	}
	return result
}
