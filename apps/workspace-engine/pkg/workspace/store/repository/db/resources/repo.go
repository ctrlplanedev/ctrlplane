package resources

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.ResourceRepo backed by the resource table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.Resource, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse resource id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	wsUID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for GetByIdentifier", "id", r.workspaceID, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceByIdentifier(r.ctx, db.GetResourceByIdentifierParams{
		WorkspaceID: wsUID,
		Identifier:  identifier,
	})
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.Resource) error {
	entity.WorkspaceId = r.workspaceID
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertResource(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert resource: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteResource(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Resource {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	rows, err := db.GetQueries(r.ctx).ListResourcesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list resources by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	result := make(map[string]*oapi.Resource, len(rows))
	for _, row := range rows {
		res := ToOapi(row)
		result[res.Id] = res
	}
	return result
}
