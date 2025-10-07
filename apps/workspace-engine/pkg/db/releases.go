package db

// import (
// 	"context"
// 	"time"
// 	"workspace-engine/pkg/pb"

// 	"github.com/jackc/pgx/v5"
// )

// const RELEASE_SELECT_QUERY = `
// 	SELECT
// 	jsonb_build_object(
// 		'id', dv.id,
// 		'name', dv.name,
// 		'tag', dv.tag,
// 		'config', dv.config,
// 		'job_agent_config', dv.job_agent_config,
// 		'deployment_id', dv.deployment_id,
// 		'status', dv.status,
// 		'message', dv.message,
// 		'created_at', dv.created_at
// 	) AS deployment_version,

// 	COALESCE(vars.variables, '{}'::jsonb) AS variables,

// 	jsonb_build_object(
// 		'id', rt.id,
// 		'resource_id', rt.resource_id,
// 		'environment_id', rt.environment_id,
// 		'deployment_id', rt.deployment_id
// 	) AS release_target,

// 	r.created_at

// 	FROM release r
// 	INNER JOIN version_release vr ON vr.id = r.version_release_id
// 	INNER JOIN deployment_version dv ON dv.id = vr.version_id
// 	INNER JOIN variable_set_release vsr ON vsr.id = r.variable_release_id
// 	INNER JOIN release_target rt ON rt.id = vsr.release_target_id
// 	INNER JOIN resource res ON res.id = rt.resource_id
// 	LEFT JOIN LATERAL (
// 		SELECT jsonb_object_agg(vvs.key, vvs.value::text) AS variables
// 		FROM variable_set_release_value vsrv
// 		INNER JOIN variable_value_snapshot vvs ON vvs.id = vsrv.variable_value_snapshot_id
// 		WHERE vsrv.variable_set_release_id = vsr.id
// 	) vars ON true
// 	WHERE res.workspace_id = $1
// `

// func getReleases(ctx context.Context, workspaceID string) ([]*pb.Release, error) {
// 	db, err := GetDB(ctx)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer db.Release()

// 	rows, err := db.Query(ctx, RELEASE_SELECT_QUERY, workspaceID)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer rows.Close()

// 	releases := make([]*pb.Release, 0)
// 	for rows.Next() {
// 		release, err := scanReleaseRow(rows)
// 		if err != nil {
// 			return nil, err
// 		}
// 		releases = append(releases, release)
// 	}

// 	if err := rows.Err(); err != nil {
// 		return nil, err
// 	}

// 	return releases, nil
// }

// func scanReleaseRow(rows pgx.Rows) (*pb.Release, error) {
// 	var deploymentVersion pb.DeploymentVersion
// 	var variables map[string]*pb.VariableValue
// 	var releaseTarget pb.ReleaseTarget
// 	var createdAt time.Time

// 	err := rows.Scan(
// 		&deploymentVersion,
// 		&variables,
// 		&releaseTarget,
// 		&createdAt,
// 	)
// 	if err != nil {
// 		return nil, err
// 	}

// 	release := &pb.Release{
// 		Version:       &deploymentVersion,
// 		Variables:     variables,
// 		ReleaseTarget: &releaseTarget,
// 		CreatedAt:     createdAt.Format(time.RFC3339),
// 	}
// 	return release, nil
// }
