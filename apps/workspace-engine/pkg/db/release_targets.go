package db

import (
	"context"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const WRITE_RELEASE_TARGET_QUERY = `
	INSERT INTO release_target (resource_id, environment_id, deployment_id)
	VALUES ($1, $2, $3)
	ON CONFLICT (resource_id, environment_id, deployment_id) 
	DO NOTHING
`

func writeReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, WRITE_RELEASE_TARGET_QUERY, releaseTarget.ResourceId, releaseTarget.EnvironmentId, releaseTarget.DeploymentId)
	return err
}

const DELETE_RELEASE_TARGET_QUERY = `
	DELETE FROM release_target 
	WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3
`

func deleteReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, DELETE_RELEASE_TARGET_QUERY, releaseTarget.ResourceId, releaseTarget.EnvironmentId, releaseTarget.DeploymentId)
	return err
}
