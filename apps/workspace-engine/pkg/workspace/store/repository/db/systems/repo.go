package systems

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.SystemRepo backed by the system table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.System, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse system id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetSystemByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.System) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertSystem(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert system: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteSystem(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.System {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.System)
	}

	rows, err := db.GetQueries(r.ctx).ListSystemsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list systems by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.System)
	}

	result := make(map[string]*oapi.System, len(rows))
	for _, row := range rows {
		s := ToOapi(row)
		result[s.Id] = s
	}
	return result
}
