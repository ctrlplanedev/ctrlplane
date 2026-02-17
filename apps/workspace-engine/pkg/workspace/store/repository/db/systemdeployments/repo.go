package systemdeployments

import (
	"context"
	"workspace-engine/pkg/db"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.SystemDeploymentRepo backed by the
// system_deployment join table.
type Repo struct {
	ctx context.Context
}

func NewRepo(ctx context.Context) *Repo {
	return &Repo{ctx: ctx}
}

func (r *Repo) GetSystemIDsForDeployment(deploymentID string) []string {
	uid, err := uuid.Parse(deploymentID)
	if err != nil {
		log.Warn("Failed to parse deployment id", "id", deploymentID, "error", err)
		return nil
	}

	systemIDs, err := db.GetQueries(r.ctx).GetSystemIDsForDeployment(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to get system IDs for deployment", "deploymentId", deploymentID, "error", err)
		return nil
	}

	result := make([]string, 0, len(systemIDs))
	for _, id := range systemIDs {
		result = append(result, id.String())
	}
	return result
}

func (r *Repo) GetDeploymentIDsForSystem(systemID string) []string {
	uid, err := uuid.Parse(systemID)
	if err != nil {
		log.Warn("Failed to parse system id", "id", systemID, "error", err)
		return nil
	}

	deploymentIDs, err := db.GetQueries(r.ctx).GetDeploymentIDsForSystem(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to get deployment IDs for system", "systemId", systemID, "error", err)
		return nil
	}

	result := make([]string, 0, len(deploymentIDs))
	for _, id := range deploymentIDs {
		result = append(result, id.String())
	}
	return result
}

func (r *Repo) Link(systemID, deploymentID string) error {
	sysUID, err := uuid.Parse(systemID)
	if err != nil {
		return err
	}
	depUID, err := uuid.Parse(deploymentID)
	if err != nil {
		return err
	}

	return db.GetQueries(r.ctx).UpsertSystemDeployment(r.ctx, db.UpsertSystemDeploymentParams{
		SystemID:     sysUID,
		DeploymentID: depUID,
	})
}

func (r *Repo) Unlink(systemID, deploymentID string) error {
	sysUID, err := uuid.Parse(systemID)
	if err != nil {
		return err
	}
	depUID, err := uuid.Parse(deploymentID)
	if err != nil {
		return err
	}

	return db.GetQueries(r.ctx).DeleteSystemDeployment(r.ctx, db.DeleteSystemDeploymentParams{
		SystemID:     sysUID,
		DeploymentID: depUID,
	})
}
