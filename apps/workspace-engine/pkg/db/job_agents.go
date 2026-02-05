package db

import (
	"context"
	"encoding/json"
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

func runnerJobAgentConfig(m map[string]interface{}) oapi.JobAgentConfig {
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"

	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.JobAgentConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		panic(err)
	}
	return cfg
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

	// Convert DB JSON (map) into the generated union type (JobAgentConfig).
	payload := map[string]interface{}{}
	if config != nil {
		for k, v := range *config {
			payload[k] = v
		}
	}

	// Prefer the discriminator stored inside the JSON config.
	// If missing (older rows), infer it from jobAgent.Type when possible; otherwise fall back to "custom".
	if t, ok := payload["type"].(string); !ok || t == "" {
		switch jobAgent.Type {
		case "github-app", "argo-cd", "tfe", "test-runner", "custom":
			payload["type"] = jobAgent.Type
		default:
			payload["type"] = "custom"
		}
	}

	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	var cfg oapi.JobAgentConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		// Backwards-compatible fallback for unknown discriminators: treat as "custom".
		payload["type"] = "custom"
		b2, mErr := json.Marshal(payload)
		if mErr != nil {
			return nil, mErr
		}
		if err2 := json.Unmarshal(b2, &cfg); err2 != nil {
			return nil, err
		}
	}

	jobAgent.Config = cfg
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
