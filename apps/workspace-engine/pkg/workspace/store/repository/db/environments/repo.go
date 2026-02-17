package environments

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.EnvironmentRepo backed by the environment table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.Environment, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse environment id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetEnvironmentByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.Environment) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	wsID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id: %w", err)
	}
	params.WorkspaceID = wsID

	_, err = db.GetQueries(r.ctx).UpsertEnvironment(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert environment: %w", err)
	}

	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteEnvironment(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Environment {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Environment)
	}

	rows, err := db.GetQueries(r.ctx).ListEnvironmentsByWorkspaceID(r.ctx, db.ListEnvironmentsByWorkspaceIDParams{
		WorkspaceID: uid,
	})
	if err != nil {
		log.Warn("Failed to list environments by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Environment)
	}

	result := make(map[string]*oapi.Environment, len(rows))
	for _, row := range rows {
		e := ToOapi(row)
		result[e.Id] = e
	}
	return result
}
