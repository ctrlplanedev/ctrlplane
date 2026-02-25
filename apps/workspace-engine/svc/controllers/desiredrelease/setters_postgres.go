package desiredrelease

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetDesiredRelease(ctx context.Context, rt *ReleaseTarget, release *oapi.Release) error {
	q := db.GetQueries(ctx)

	versionID, err := uuid.Parse(release.Version.Id)
	if err != nil {
		return fmt.Errorf("parse version id: %w", err)
	}

	_, err = q.UpsertRelease(ctx, db.UpsertReleaseParams{
		ID:            release.UUID(),
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
		VersionID:     versionID,
		CreatedAt:     pgtype.Timestamptz{},
	})
	if err != nil {
		return fmt.Errorf("upsert release: %w", err)
	}

	for key, val := range release.Variables {
		valBytes, err := json.Marshal(val)
		if err != nil {
			return fmt.Errorf("marshal variable %q: %w", key, err)
		}
		_, err = q.UpsertReleaseVariable(ctx, db.UpsertReleaseVariableParams{
			ID:        uuid.New(),
			ReleaseID: release.UUID(),
			Key:       key,
			Value:     valBytes,
			Encrypted: false,
		})
		if err != nil {
			return fmt.Errorf("upsert variable %q: %w", key, err)
		}
	}

	// TODO: Upsert the desired_release relationship in the release_target join
	// table once the SQL migration and sqlc query exist.

	return nil
}
