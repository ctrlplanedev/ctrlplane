package releases

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	dvmapper "workspace-engine/pkg/workspace/store/repository/db/deploymentversions"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.ReleaseRepo backed by the release and
// release_variable tables via sqlc queries.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

// fetchOapiRelease loads the deployment version and variables for a db.Release
// row, then assembles the full oapi.Release.
func (r *Repo) fetchOapiRelease(row db.Release) (*oapi.Release, error) {
	dvRow, err := db.GetQueries(r.ctx).GetDeploymentVersionByID(r.ctx, row.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get deployment version %s: %w", row.VersionID, err)
	}

	version, err := dvmapper.ToOapi(dvRow)
	if err != nil {
		return nil, fmt.Errorf("convert deployment version: %w", err)
	}

	vars, err := db.GetQueries(r.ctx).GetReleaseVariablesByReleaseID(r.ctx, row.ID)
	if err != nil {
		return nil, fmt.Errorf("get release variables: %w", err)
	}

	return ToOapi(row, version, vars), nil
}

func (r *Repo) Get(id string) (*oapi.Release, bool) {
	uid := uuid.NewSHA1(uuid.NameSpaceOID, []byte(id))

	row, err := db.GetQueries(r.ctx).GetReleaseByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	release, err := r.fetchOapiRelease(row)
	if err != nil {
		log.Warn("Failed to assemble release", "id", id, "error", err)
		return nil, false
	}

	return release, true
}

func (r *Repo) GetByReleaseTargetKey(key string) ([]*oapi.Release, error) {
	if len(key) != 110 {
		return nil, fmt.Errorf("invalid release target key length: %d", len(key))
	}

	resourceID, err := uuid.Parse(key[0:36])
	if err != nil {
		return nil, fmt.Errorf("parse resource_id from key: %w", err)
	}
	environmentID, err := uuid.Parse(key[37:73])
	if err != nil {
		return nil, fmt.Errorf("parse environment_id from key: %w", err)
	}
	deploymentID, err := uuid.Parse(key[74:110])
	if err != nil {
		return nil, fmt.Errorf("parse deployment_id from key: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListReleasesByReleaseTarget(r.ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    resourceID,
		EnvironmentID: environmentID,
		DeploymentID:  deploymentID,
	})
	if err != nil {
		return nil, fmt.Errorf("list releases by target: %w", err)
	}

	result := make([]*oapi.Release, 0, len(rows))
	for _, row := range rows {
		release, err := r.fetchOapiRelease(row)
		if err != nil {
			log.Warn("Failed to assemble release", "release_id", row.ID, "error", err)
			continue
		}
		result = append(result, release)
	}

	return result, nil
}

func (r *Repo) Set(entity *oapi.Release) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertRelease(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert release: %w", err)
	}

	releaseUUID := entity.UUID()

	encryptedKeys := make(map[string]bool, len(entity.EncryptedVariables))
	for _, k := range entity.EncryptedVariables {
		encryptedKeys[k] = true
	}

	for key, value := range entity.Variables {
		varParams, err := ToVariableUpsertParams(releaseUUID, key, value, encryptedKeys[key])
		if err != nil {
			return fmt.Errorf("convert variable %q: %w", key, err)
		}

		_, err = db.GetQueries(r.ctx).UpsertReleaseVariable(r.ctx, varParams)
		if err != nil {
			return fmt.Errorf("upsert release variable %q: %w", key, err)
		}
	}

	return nil
}

func (r *Repo) Remove(id string) error {
	uid := uuid.NewSHA1(uuid.NameSpaceOID, []byte(id))

	if err := db.GetQueries(r.ctx).DeleteReleaseVariablesByReleaseID(r.ctx, uid); err != nil {
		return fmt.Errorf("delete release variables: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteRelease(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Release {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Release)
	}

	rows, err := db.GetQueries(r.ctx).ListReleasesByWorkspaceID(r.ctx, db.ListReleasesByWorkspaceIDParams{
		WorkspaceID: uid,
	})
	if err != nil {
		log.Warn("Failed to list releases by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Release)
	}

	result := make(map[string]*oapi.Release, len(rows))
	for _, row := range rows {
		release, err := r.fetchOapiRelease(row)
		if err != nil {
			log.Warn("Failed to assemble release", "release_id", row.ID, "error", err)
			continue
		}
		result[release.ID()] = release
	}

	return result
}
