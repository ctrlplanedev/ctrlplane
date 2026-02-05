package db

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const DEPLOYMENT_SELECT_QUERY = `
	SELECT
		d.id,
		d.name,
		d.slug,
		d.description,
		d.system_id,
		d.job_agent_id,
		d.job_agent_config,
		d.resource_selector,
		COALESCE(
			json_object_agg(
				COALESCE(dm.key, ''),
				COALESCE(dm.value, '')
			) FILTER (WHERE dm.key IS NOT NULL),
			'{}'::json
		) as metadata
	FROM deployment d
	INNER JOIN system s ON s.id = d.system_id
	LEFT JOIN deployment_metadata dm ON dm.deployment_id = d.id
	WHERE s.workspace_id = $1
	GROUP BY d.id, d.name, d.slug, d.description, d.system_id, d.job_agent_id, d.job_agent_config, d.resource_selector
`

func getDeployments(ctx context.Context, workspaceID string) ([]*oapi.Deployment, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, DEPLOYMENT_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deployments := make([]*oapi.Deployment, 0)
	for rows.Next() {
		var deployment oapi.Deployment
		var rawSelector map[string]interface{}
		var metadataJSON []byte

		err := rows.Scan(
			&deployment.Id,
			&deployment.Name,
			&deployment.Slug,
			&deployment.Description,
			&deployment.SystemId,
			&deployment.JobAgentId,
			&deployment.JobAgentConfig,
			&rawSelector,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		// Wrap selector from unwrapped database format to JsonSelector format
		deployment.ResourceSelector, err = wrapSelectorFromDB(rawSelector)
		if err != nil {
			return nil, err
		}

		metadata, err := parseMetadataJSON(metadataJSON)
		if err != nil {
			return nil, err
		}
		deployment.Metadata = metadata

		deployments = append(deployments, &deployment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return deployments, nil
}

const DEPLOYMENT_UPSERT_QUERY = `
	INSERT INTO deployment (id, name, slug, description, system_id, job_agent_id, job_agent_config, resource_selector)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		slug = EXCLUDED.slug,
		description = EXCLUDED.description,
		system_id = EXCLUDED.system_id,
		job_agent_id = EXCLUDED.job_agent_id,
		job_agent_config = EXCLUDED.job_agent_config,
		resource_selector = EXCLUDED.resource_selector
`

func writeDeployment(ctx context.Context, deployment *oapi.Deployment, tx pgx.Tx) error {
	// Unwrap selector for database storage (database stores unwrapped ResourceCondition format)
	selectorToStore, err := unwrapSelectorForDB(deployment.ResourceSelector)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(
		ctx,
		DEPLOYMENT_UPSERT_QUERY,
		deployment.Id,
		deployment.Name,
		deployment.Slug,
		deployment.Description,
		deployment.SystemId,
		deployment.JobAgentId,
		deployment.JobAgentConfig,
		selectorToStore,
	); err != nil {
		return err
	}

	metadata := deployment.Metadata
	if metadata == nil {
		metadata = map[string]string{}
	}

	if _, err := tx.Exec(ctx, "DELETE FROM deployment_metadata WHERE deployment_id = $1", deployment.Id); err != nil {
		return err
	}

	if err := writeMetadata(ctx, "deployment_metadata", "deployment_id", deployment.Id, metadata, tx); err != nil {
		return err
	}

	return nil
}

const DELETE_DEPLOYMENT_QUERY = `
	DELETE FROM deployment WHERE id = $1
`

func deleteDeployment(ctx context.Context, deploymentId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_DEPLOYMENT_QUERY, deploymentId); err != nil {
		return err
	}
	return nil
}
