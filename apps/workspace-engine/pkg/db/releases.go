package db

import (
	"context"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const RELEASE_SELECT_QUERY = `
	SELECT
	jsonb_build_object(
		'id', dv.id,
		'name', dv.name,
		'tag', dv.tag,
		'config', dv.config,
		'jobAgentConfig', dv.job_agent_config,
		'deploymentId', dv.deployment_id,
		'status', dv.status,
		'message', dv.message,
		'createdAt', dv.created_at
	) AS version,

	COALESCE(vars.variables, '{}'::jsonb) AS variables,

	jsonb_build_object(
		'resourceId', rt.resource_id,
		'environmentId', rt.environment_id,
		'deploymentId', rt.deployment_id
	) AS releaseTarget,

	r.created_at AS createdAt

	FROM release r
	INNER JOIN version_release vr ON vr.id = r.version_release_id
	INNER JOIN deployment_version dv ON dv.id = vr.version_id
	INNER JOIN variable_set_release vsr ON vsr.id = r.variable_release_id
	INNER JOIN release_target rt ON rt.id = vsr.release_target_id
	INNER JOIN resource res ON res.id = rt.resource_id
	LEFT JOIN LATERAL (
		SELECT jsonb_object_agg(vvs.key, vvs.value) AS variables
		FROM variable_set_release_value vsrv
		INNER JOIN variable_value_snapshot vvs ON vvs.id = vsrv.variable_value_snapshot_id
		WHERE vsrv.variable_set_release_id = vsr.id
	) vars ON true
	WHERE res.workspace_id = $1
`

func getReleases(ctx context.Context, workspaceID string) ([]*oapi.Release, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, RELEASE_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	releases := make([]*oapi.Release, 0)
	for rows.Next() {
		release, err := scanReleaseRow(rows)
		if err != nil {
			return nil, err
		}
		releases = append(releases, release)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return releases, nil
}

func scanReleaseRow(rows pgx.Rows) (*oapi.Release, error) {
	var deploymentVersion oapi.DeploymentVersion
	var variables map[string]oapi.LiteralValue
	var releaseTarget oapi.ReleaseTarget
	var createdAt time.Time

	err := rows.Scan(
		&deploymentVersion,
		&variables,
		&releaseTarget,
		&createdAt,
	)
	if err != nil {
		return nil, err
	}

	release := &oapi.Release{
		Version:       deploymentVersion,
		Variables:     variables,
		ReleaseTarget: releaseTarget,
		CreatedAt:     createdAt.Format(time.RFC3339),
	}
	return release, nil
}

const RELEASE_TARGET_SELECT_QUERY = `
	SELECT id FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3
`

func getReleaseTargetId(ctx context.Context, release *oapi.Release, tx pgx.Tx) (string, error) {
	var releaseTargetId string
	err := tx.QueryRow(ctx, RELEASE_TARGET_SELECT_QUERY, release.ReleaseTarget.ResourceId, release.ReleaseTarget.EnvironmentId, release.ReleaseTarget.DeploymentId).Scan(&releaseTargetId)
	if err != nil {
		return "", err
	}
	return releaseTargetId, nil
}

const VERSION_RELEASE_INSERT_QUERY = `
	INSERT INTO version_release (release_target_id, version_id)
	VALUES ($1, $2)
	RETURNING id
`

func writeVersionRelease(ctx context.Context, release *oapi.Release, releaseTargetId string, tx pgx.Tx) (string, error) {
	var versionReleaseID string
	if err := tx.QueryRow(ctx, VERSION_RELEASE_INSERT_QUERY, releaseTargetId, release.Version.Id).Scan(&versionReleaseID); err != nil {
		return "", err
	}
	return versionReleaseID, nil
}

const EXISTING_VARIABLE_VALUE_SNAPSHOT_QUERY = `
	SELECT id FROM variable_value_snapshot WHERE workspace_id = $1 AND key = $2 AND value = $3
`

const INSERT_VARIABLE_VALUE_SNAPSHOT_QUERY = `
	INSERT INTO variable_value_snapshot (workspace_id, key, value, sensitive)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (workspace_id, key, value) DO UPDATE SET value = EXCLUDED.value
	RETURNING id
`

const VARIABLE_SET_RELEASE_INSERT_QUERY = `
	INSERT INTO variable_set_release (release_target_id)
	VALUES ($1)
	RETURNING id
`

func writeVariableSetRelease(ctx context.Context, release *oapi.Release, releaseTargetId string, workspaceID string, tx pgx.Tx) (string, error) {
	variables := release.Variables

	variableValueSnapshotIDs := make([]string, 0)

	for key, value := range variables {
		var existingSnapshotID *string
		err := tx.QueryRow(ctx, EXISTING_VARIABLE_VALUE_SNAPSHOT_QUERY, workspaceID, key, value).Scan(&existingSnapshotID)
		if err != nil && err != pgx.ErrNoRows {
			return "", err
		}
		if existingSnapshotID != nil {
			variableValueSnapshotIDs = append(variableValueSnapshotIDs, *existingSnapshotID)
			continue
		}

		var newSnapshotID string
		if err := tx.QueryRow(ctx, INSERT_VARIABLE_VALUE_SNAPSHOT_QUERY, workspaceID, key, value, false).Scan(&newSnapshotID); err != nil {
			return "", err
		}
		variableValueSnapshotIDs = append(variableValueSnapshotIDs, newSnapshotID)
	}

	var variableSetReleaseID string
	if err := tx.QueryRow(ctx, VARIABLE_SET_RELEASE_INSERT_QUERY, releaseTargetId).Scan(&variableSetReleaseID); err != nil {
		return "", err
	}

	if len(variableValueSnapshotIDs) == 0 {
		return variableSetReleaseID, nil
	}

	valueStrings := make([]string, 0, len(variableValueSnapshotIDs))
	valueArgs := make([]interface{}, 0, len(variableValueSnapshotIDs)*2)
	i := 1
	for _, snapshotID := range variableValueSnapshotIDs {
		valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d)", i, i+1))
		valueArgs = append(valueArgs, variableSetReleaseID, snapshotID)
		i += 2
	}

	query := "INSERT INTO variable_set_release_value (variable_set_release_id, variable_value_snapshot_id) VALUES " +
		strings.Join(valueStrings, ", ") +
		" ON CONFLICT (variable_set_release_id, variable_value_snapshot_id) DO NOTHING"

	_, err := tx.Exec(ctx, query, valueArgs...)
	return variableSetReleaseID, err
}

const RELEASE_INSERT_QUERY = `
	INSERT INTO release (id, version_release_id, variable_release_id)
	VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET version_release_id = EXCLUDED.version_release_id, variable_release_id = EXCLUDED.variable_release_id
	RETURNING id
`

func writeRelease(ctx context.Context, release *oapi.Release, workspaceID string, tx pgx.Tx) error {
	releaseTargetId, err := getReleaseTargetId(ctx, release, tx)
	if err != nil {
		return err
	}

	versionReleaseID, err := writeVersionRelease(ctx, release, releaseTargetId, tx)
	if err != nil {
		return err
	}

	variableSetReleaseID, err := writeVariableSetRelease(ctx, release, releaseTargetId, workspaceID, tx)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, RELEASE_INSERT_QUERY, release.UUID().String(), versionReleaseID, variableSetReleaseID)
	return err
}

const DELETE_RELEASE_QUERY = `
	DELETE FROM release WHERE id = $1
`
