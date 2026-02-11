package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// dbDeploymentVersionRepo implements repository.DeploymentVersionRepo
// backed by the deployment_version table via sqlc queries.
type dbDeploymentVersionRepo struct {
	ctx         context.Context
	workspaceID string
}

// NewDeploymentVersionRepo returns a DB-backed DeploymentVersionRepo.
// The provided context is used for all database operations.
func NewDeploymentVersionRepo(ctx context.Context, workspaceID string) *dbDeploymentVersionRepo {
	return &dbDeploymentVersionRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *dbDeploymentVersionRepo) Get(id string) (*oapi.DeploymentVersion, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse deployment version id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetDeploymentVersionByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	v, err := ToOapi(row)
	if err != nil {
		log.Warn("Failed to convert deployment version", "id", id, "error", err)
		return nil, false
	}
	return v, true
}

func (r *dbDeploymentVersionRepo) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	uid, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment_id: %w", err)
	}

	args := db.ListDeploymentVersionsByDeploymentIDParams{
		DeploymentID: uid,
	}
	rows, err := db.GetQueries(r.ctx).ListDeploymentVersionsByDeploymentID(r.ctx, args)
	if err != nil {
		return nil, fmt.Errorf("list deployment versions: %w", err)
	}

	result := make([]*oapi.DeploymentVersion, 0, len(rows))
	for _, row := range rows {
		v, err := ToOapi(row)
		if err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, nil
}

func (r *dbDeploymentVersionRepo) Set(entity *oapi.DeploymentVersion) error {
	params, err := ToUpsertParams(r.workspaceID, entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertDeploymentVersion(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert deployment version: %w", err)
	}
	return nil
}

func (r *dbDeploymentVersionRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteDeploymentVersion(r.ctx, uid)
}

func (r *dbDeploymentVersionRepo) Items() map[string]*oapi.DeploymentVersion {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVersion)
	}

	args := db.ListDeploymentVersionsByWorkspaceIDParams{
		WorkspaceID: uid,
	}
	rows, err := db.GetQueries(r.ctx).ListDeploymentVersionsByWorkspaceID(r.ctx, args)
	if err != nil {
		log.Warn("Failed to list deployment versions by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVersion)
	}

	result := make(map[string]*oapi.DeploymentVersion, len(rows))
	for _, row := range rows {
		v, err := ToOapi(row)
		if err != nil {
			log.Warn("Failed to convert deployment version", "error", err)
			continue
		}
		result[v.Id] = v
	}
	return result
}
