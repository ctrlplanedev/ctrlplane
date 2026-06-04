package workflows

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
)

type Getter interface {
	GetWorkflowByID(ctx context.Context, workflowID string) (*oapi.Workflow, error)
	GetResourcesMatching(ctx context.Context, workspaceID, sel string) ([]*oapi.Resource, error)
	GetJobAgentsByRef(
		ctx context.Context,
		workspaceID string,
		jobAgents []oapi.WorkflowJobAgent,
	) (map[string]db.JobAgent, error)
}

type PostgresGetter struct{}

var _ Getter = &PostgresGetter{}

func convertInputs(raw []byte) ([]oapi.WorkflowInput, error) {
	var inputs []oapi.WorkflowInput
	if err := json.Unmarshal(raw, &inputs); err != nil {
		return nil, fmt.Errorf("failed to parse workflow inputs: %w", err)
	}
	return inputs, nil
}

func convertJobAgents(raw []byte) ([]oapi.WorkflowJobAgent, error) {
	var agents []oapi.WorkflowJobAgent
	if err := json.Unmarshal(raw, &agents); err != nil {
		return nil, fmt.Errorf("failed to parse workflow job agents: %w", err)
	}
	return agents, nil
}

func (g *PostgresGetter) GetWorkflowByID(
	ctx context.Context,
	workflowID string,
) (*oapi.Workflow, error) {
	workflowIDUUID, err := uuid.Parse(workflowID)
	if err != nil {
		return nil, fmt.Errorf("parse workflow id: %w", err)
	}
	workflowRow, err := db.GetQueries(ctx).GetWorkflowByID(ctx, workflowIDUUID)
	if err != nil {
		return nil, err
	}

	inputs, err := convertInputs(workflowRow.Inputs)
	if err != nil {
		return nil, err
	}

	jobs, err := convertJobAgents(workflowRow.JobAgents)
	if err != nil {
		return nil, err
	}

	return &oapi.Workflow{
		Id:     workflowRow.ID.String(),
		Name:   workflowRow.Name,
		Slug:   workflowRow.Slug,
		Inputs: inputs,
		Jobs:   jobs,
	}, nil
}

func (g *PostgresGetter) GetResourcesMatching(
	ctx context.Context,
	workspaceID, sel string,
) ([]*oapi.Resource, error) {
	if sel == "" {
		return []*oapi.Resource{nil}, nil
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	rows, err := db.GetQueries(ctx).ListResourcesByWorkspaceID(ctx, workspaceUUID)
	if err != nil {
		return nil, fmt.Errorf("list resources: %w", err)
	}

	all := make([]*oapi.Resource, 0, len(rows))
	for _, row := range rows {
		all = append(all, db.ToOapiResource(db.GetResourceByIDRow(row)))
	}

	matched, err := selector.Filter(ctx, sel, all)
	if err != nil {
		return nil, fmt.Errorf("filter resources: %w", err)
	}
	return matched, nil
}

func (g *PostgresGetter) GetJobAgentsByRef(
	ctx context.Context,
	workspaceID string,
	jobAgents []oapi.WorkflowJobAgent,
) (map[string]db.JobAgent, error) {
	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	queries := db.GetQueries(ctx)
	runners := make(map[string]db.JobAgent, len(jobAgents))
	for _, jobAgent := range jobAgents {
		if _, ok := runners[jobAgent.Ref]; ok {
			continue
		}
		runnerID, err := uuid.Parse(jobAgent.Ref)
		if err != nil {
			return nil, fmt.Errorf("parse job agent id: %w", err)
		}
		runner, err := queries.GetJobAgentByID(ctx, runnerID)
		if err != nil {
			return nil, fmt.Errorf("get job agent: %w", err)
		}
		if runner.WorkspaceID != workspaceUUID {
			return nil, fmt.Errorf(
				"job agent %s does not belong to workspace %s",
				runnerID, workspaceUUID,
			)
		}
		runners[jobAgent.Ref] = runner
	}
	return runners, nil
}
