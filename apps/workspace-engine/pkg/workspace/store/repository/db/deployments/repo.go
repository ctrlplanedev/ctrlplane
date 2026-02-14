package deployments

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.DeploymentRepo backed by the deployment table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

// resolveSystemID looks up the system_id for a deployment from the join table.
func (r *Repo) resolveSystemID(deploymentID uuid.UUID) string {
	systemID, err := db.GetQueries(r.ctx).GetSystemIDForDeployment(r.ctx, deploymentID)
	if err != nil {
		return ""
	}
	return systemID.String()
}

func (r *Repo) Get(id string) (*oapi.Deployment, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse deployment id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetDeploymentByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	d := ToOapi(row)
	d.SystemId = r.resolveSystemID(uid)
	return d, true
}

func (r *Repo) GetBySystemID(systemID string) map[string]*oapi.Deployment {
	uid, err := uuid.Parse(systemID)
	if err != nil {
		log.Warn("Failed to parse system id for GetBySystemID", "id", systemID, "error", err)
		return make(map[string]*oapi.Deployment)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentsBySystemID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list deployments by system", "systemId", systemID, "error", err)
		return make(map[string]*oapi.Deployment)
	}

	result := make(map[string]*oapi.Deployment, len(rows))
	for _, row := range rows {
		d := ToOapi(row)
		d.SystemId = systemID
		result[d.Id] = d
	}
	return result
}

func (r *Repo) Set(entity *oapi.Deployment) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	wsID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id: %w", err)
	}
	params.WorkspaceID = wsID

	_, err = db.GetQueries(r.ctx).UpsertDeployment(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert deployment: %w", err)
	}

	// Maintain the system_deployment join.
	// First, remove any existing mapping so a deployment can move between systems.
	deploymentID, _ := uuid.Parse(entity.Id)
	if err := db.GetQueries(r.ctx).DeleteSystemDeploymentByDeploymentID(r.ctx, deploymentID); err != nil {
		log.Warn("Failed to delete old system_deployment join",
			"deployment_id", entity.Id, "error", err)
	}

	// Then insert the new mapping if a system_id is set.
	systemID, err := uuid.Parse(entity.SystemId)
	if err == nil && systemID != uuid.Nil {
		if err := db.GetQueries(r.ctx).UpsertSystemDeployment(r.ctx, db.UpsertSystemDeploymentParams{
			SystemID:     systemID,
			DeploymentID: deploymentID,
		}); err != nil {
			log.Warn("Failed to upsert system_deployment join",
				"system_id", entity.SystemId, "deployment_id", entity.Id, "error", err)
		}
	}

	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteDeployment(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Deployment {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Deployment)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentsByWorkspaceID(r.ctx, db.ListDeploymentsByWorkspaceIDParams{
		WorkspaceID: uid,
	})
	if err != nil {
		log.Warn("Failed to list deployments by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Deployment)
	}

	result := make(map[string]*oapi.Deployment, len(rows))
	for _, row := range rows {
		d := ToOapi(row)
		d.SystemId = r.resolveSystemID(row.ID)
		result[d.Id] = d
	}
	return result
}
