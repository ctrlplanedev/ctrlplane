package releases

import (
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ToOapi converts a db.Release row, its associated deployment version, and
// its variables into an oapi.Release.
func ToOapi(
	row db.Release,
	version *oapi.DeploymentVersion,
	vars []db.ReleaseVariable,
) *oapi.Release {
	variables := make(map[string]oapi.LiteralValue, len(vars))
	var encrypted []string
	for _, v := range vars {
		var lv oapi.LiteralValue
		if err := json.Unmarshal(v.Value, &lv); err == nil {
			variables[v.Key] = lv
		}
		if v.Encrypted {
			encrypted = append(encrypted, v.Key)
		}
	}

	var createdAt string
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time.Format(time.RFC3339)
	}

	return &oapi.Release{
		CreatedAt:          createdAt,
		EncryptedVariables: encrypted,
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    row.ResourceID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			DeploymentId:  row.DeploymentID.String(),
		},
		Variables: variables,
		Version:   *version,
	}
}

// ToUpsertParams converts an oapi.Release into sqlc upsert params.
func ToUpsertParams(release *oapi.Release) (db.UpsertReleaseParams, error) {
	resourceID, err := uuid.Parse(release.ReleaseTarget.ResourceId)
	if err != nil {
		return db.UpsertReleaseParams{}, fmt.Errorf("parse resource_id: %w", err)
	}

	environmentID, err := uuid.Parse(release.ReleaseTarget.EnvironmentId)
	if err != nil {
		return db.UpsertReleaseParams{}, fmt.Errorf("parse environment_id: %w", err)
	}

	deploymentID, err := uuid.Parse(release.ReleaseTarget.DeploymentId)
	if err != nil {
		return db.UpsertReleaseParams{}, fmt.Errorf("parse deployment_id: %w", err)
	}

	versionID, err := uuid.Parse(release.Version.Id)
	if err != nil {
		return db.UpsertReleaseParams{}, fmt.Errorf("parse version_id: %w", err)
	}

	var createdAt pgtype.Timestamptz
	if release.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, release.CreatedAt)
		if err == nil {
			createdAt = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	return db.UpsertReleaseParams{
		ID:            release.UUID(),
		ResourceID:    resourceID,
		EnvironmentID: environmentID,
		DeploymentID:  deploymentID,
		VersionID:     versionID,
		CreatedAt:     createdAt,
	}, nil
}

// ToVariableUpsertParams converts a single release variable key/value pair
// into sqlc upsert params.
func ToVariableUpsertParams(
	releaseID uuid.UUID,
	key string,
	value oapi.LiteralValue,
	encrypted bool,
) (db.UpsertReleaseVariableParams, error) {
	valueBytes, err := json.Marshal(value)
	if err != nil {
		return db.UpsertReleaseVariableParams{}, fmt.Errorf("marshal variable value: %w", err)
	}

	return db.UpsertReleaseVariableParams{
		ID:        uuid.New(),
		ReleaseID: releaseID,
		Key:       key,
		Value:     valueBytes,
		Encrypted: encrypted,
	}, nil
}
