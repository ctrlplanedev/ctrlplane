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

	return ToOapiFromGetRow(row), true
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
	systemID, err := uuid.Parse(entity.SystemId)
	if err == nil && systemID != uuid.Nil {
		deploymentID, _ := uuid.Parse(entity.Id)
		_ = db.GetQueries(r.ctx).UpsertSystemDeployment(r.ctx, db.UpsertSystemDeploymentParams{
			SystemID:     systemID,
			DeploymentID: deploymentID,
		})
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
		d := ToOapiFromListRow(row)
		result[d.Id] = d
	}
	return result
}
