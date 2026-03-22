package workflows

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type Getter interface {
	GetWorkflowByID(ctx context.Context, workflowID string) (*oapi.Workflow, error)
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
		Inputs: inputs,
		Jobs:   jobs,
	}, nil
}
