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
	ctx context.Context
}

// NewDeploymentVersionRepo returns a DB-backed DeploymentVersionRepo.
// The provided context is used for all database operations.
func NewDeploymentVersionRepo(ctx context.Context) *dbDeploymentVersionRepo {
	return &dbDeploymentVersionRepo{ctx: ctx}
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

func (r *dbDeploymentVersionRepo) GetBy(index string, args ...any) ([]*oapi.DeploymentVersion, error) {
	if index != "deployment_id" || len(args) == 0 {
		return nil, fmt.Errorf("unsupported index %q for DB deployment version repo", index)
	}

	deploymentID, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("expected string arg for deployment_id, got %T", args[0])
	}

	uid, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentVersionsByDeploymentID(r.ctx, uid)
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
	params, err := ToUpsertParams(entity)
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
	// Items is not efficiently supported by the DB repo — return empty map.
	// Callers that need to enumerate all versions should use GetBy or a
	// dedicated list query.
	return make(map[string]*oapi.DeploymentVersion)
}
