package resourceproviders

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.ResourceProviderRepo backed by the resource_provider table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.ResourceProvider, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse resource provider id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceProviderByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.ResourceProvider) error {
	wsUID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id: %w", err)
	}
	entity.WorkspaceId = wsUID
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertResourceProvider(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert resource provider: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteResourceProvider(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.ResourceProvider {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.ResourceProvider)
	}

	rows, err := db.GetQueries(r.ctx).ListResourceProvidersByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list resource providers by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.ResourceProvider)
	}

	result := make(map[string]*oapi.ResourceProvider, len(rows))
	for _, row := range rows {
		rp := ToOapi(row)
		result[rp.Id] = rp
	}
	return result
}
