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
