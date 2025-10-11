package db

import (
	"context"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const JOB_AGENT_SELECT_QUERY = `
	SELECT
		j.id,
		j.workspace_id,
		j.name,
		j.type,
		j.config
	FROM job_agent j
	WHERE j.workspace_id = $1
`

func getJobAgents(ctx context.Context, workspaceID string) ([]*oapi.JobAgent, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, JOB_AGENT_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobAgents := make([]*oapi.JobAgent, 0)
	for rows.Next() {
		jobAgent, err := scanJobAgentRow(rows)
		if err != nil {
			return nil, err
		}
		jobAgents = append(jobAgents, jobAgent)
	}
	return jobAgents, nil
}

func scanJobAgentRow(rows pgx.Rows) (*oapi.JobAgent, error) {
	jobAgent := &oapi.JobAgent{}
	var config *map[string]interface{}
	err := rows.Scan(
		&jobAgent.Id,
		&jobAgent.WorkspaceId,
		&jobAgent.Name,
		&jobAgent.Type,
		&config,
	)
	if err != nil {
		return nil, err
	}
	jobAgent.Config = *config
	return jobAgent, nil
}

const JOB_AGENT_UPSERT_QUERY = `
	INSERT INTO job_agent (id, workspace_id, name, type, config)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (id) DO UPDATE SET
		workspace_id = EXCLUDED.workspace_id,
		name = EXCLUDED.name,
		type = EXCLUDED.type,
		config = EXCLUDED.config
`

func writeJobAgent(ctx context.Context, jobAgent *oapi.JobAgent, tx pgx.Tx) error {
	if _, err := tx.Exec(
		ctx,
		JOB_AGENT_UPSERT_QUERY,
		jobAgent.Id,
		jobAgent.WorkspaceId,
		jobAgent.Name,
		jobAgent.Type,
		jobAgent.Config,
	); err != nil {
		return err
	}
	return nil
}

const DELETE_JOB_AGENT_QUERY = `
	DELETE FROM job_agent WHERE id = $1
`

func deleteJobAgent(ctx context.Context, jobAgentId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_JOB_AGENT_QUERY, jobAgentId); err != nil {
		return err
	}
	return nil
}
