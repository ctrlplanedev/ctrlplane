package systemenvironments

import (
	"context"
	"workspace-engine/pkg/db"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.SystemEnvironmentRepo backed by the
// system_environment join table.
type Repo struct {
	ctx context.Context
}

func NewRepo(ctx context.Context) *Repo {
	return &Repo{ctx: ctx}
}

func (r *Repo) GetSystemIDsForEnvironment(environmentID string) []string {
	uid, err := uuid.Parse(environmentID)
	if err != nil {
		log.Warn("Failed to parse environment id", "id", environmentID, "error", err)
		return nil
	}

	systemIDs, err := db.GetQueries(r.ctx).GetSystemIDsForEnvironment(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to get system IDs for environment", "environmentId", environmentID, "error", err)
		return nil
	}

	result := make([]string, 0, len(systemIDs))
	for _, id := range systemIDs {
		result = append(result, id.String())
	}
	return result
}

func (r *Repo) GetEnvironmentIDsForSystem(systemID string) []string {
	uid, err := uuid.Parse(systemID)
	if err != nil {
		log.Warn("Failed to parse system id", "id", systemID, "error", err)
		return nil
	}

	environmentIDs, err := db.GetQueries(r.ctx).GetEnvironmentIDsForSystem(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to get environment IDs for system", "systemId", systemID, "error", err)
		return nil
	}

	result := make([]string, 0, len(environmentIDs))
	for _, id := range environmentIDs {
		result = append(result, id.String())
	}
	return result
}

func (r *Repo) Link(systemID, environmentID string) error {
	sysUID, err := uuid.Parse(systemID)
	if err != nil {
		return err
	}
	envUID, err := uuid.Parse(environmentID)
	if err != nil {
		return err
	}

	return db.GetQueries(r.ctx).UpsertSystemEnvironment(r.ctx, db.UpsertSystemEnvironmentParams{
		SystemID:      sysUID,
		EnvironmentID: envUID,
	})
}

func (r *Repo) Unlink(systemID, environmentID string) error {
	sysUID, err := uuid.Parse(systemID)
	if err != nil {
		return err
	}
	envUID, err := uuid.Parse(environmentID)
	if err != nil {
		return err
	}

	return db.GetQueries(r.ctx).DeleteSystemEnvironment(r.ctx, db.DeleteSystemEnvironmentParams{
		SystemID:      sysUID,
		EnvironmentID: envUID,
	})
}
