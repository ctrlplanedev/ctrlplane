package db

import (
	"context"
	"workspace-engine/pkg/pb"

	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/types/known/structpb"
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

func getJobAgents(ctx context.Context, workspaceID string) ([]*pb.JobAgent, error) {
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

	jobAgents := make([]*pb.JobAgent, 0)
	for rows.Next() {
		jobAgent, err := scanJobAgentRow(rows)
		if err != nil {
			return nil, err
		}
		jobAgents = append(jobAgents, jobAgent)
	}
	return jobAgents, nil
}

func scanJobAgentRow(rows pgx.Rows) (*pb.JobAgent, error) {
	jobAgent := &pb.JobAgent{}
	var config *structpb.Struct
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
	jobAgent.Config = config
	return jobAgent, nil
}
