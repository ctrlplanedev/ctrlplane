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

// resolveSystemID looks up the system_id for an environment from the join table.
func (r *Repo) resolveSystemID(environmentID uuid.UUID) string {
	systemID, err := db.GetQueries(r.ctx).GetSystemIDForEnvironment(r.ctx, environmentID)
	if err != nil {
		return ""
	}
	return systemID.String()
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

	e := ToOapi(row)
	e.SystemId = r.resolveSystemID(uid)
	return e, true
}

func (r *Repo) GetBySystemID(systemID string) map[string]*oapi.Environment {
	uid, err := uuid.Parse(systemID)
	if err != nil {
		log.Warn("Failed to parse system id for GetBySystemID", "id", systemID, "error", err)
		return make(map[string]*oapi.Environment)
	}

	rows, err := db.GetQueries(r.ctx).ListEnvironmentsBySystemID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list environments by system", "systemId", systemID, "error", err)
		return make(map[string]*oapi.Environment)
	}

	result := make(map[string]*oapi.Environment, len(rows))
	for _, row := range rows {
		e := ToOapi(row)
		e.SystemId = systemID
		result[e.Id] = e
	}
	return result
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

	// Maintain the system_environment join.
	// First, remove any existing mapping so an environment can move between systems.
	environmentID, _ := uuid.Parse(entity.Id)
	if err := db.GetQueries(r.ctx).DeleteSystemEnvironmentByEnvironmentID(r.ctx, environmentID); err != nil {
		log.Warn("Failed to delete old system_environment join",
			"environment_id", entity.Id, "error", err)
	}

	// Then insert the new mapping if a system_id is set.
	systemID, err := uuid.Parse(entity.SystemId)
	if err == nil && systemID != uuid.Nil {
		if err := db.GetQueries(r.ctx).UpsertSystemEnvironment(r.ctx, db.UpsertSystemEnvironmentParams{
			SystemID:      systemID,
			EnvironmentID: environmentID,
		}); err != nil {
			log.Warn("Failed to upsert system_environment join",
				"system_id", entity.SystemId, "environment_id", entity.Id, "error", err)
		}
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
		e.SystemId = r.resolveSystemID(row.ID)
		result[e.Id] = e
	}
	return result
}
