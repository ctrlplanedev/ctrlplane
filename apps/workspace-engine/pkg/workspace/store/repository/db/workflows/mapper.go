package workflows

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func WorkflowToOapi(row db.Workflow) *oapi.Workflow {
	var inputs []oapi.WorkflowInput
	if row.Inputs != nil {
		_ = json.Unmarshal(row.Inputs, &inputs)
	}

	var jobs []oapi.WorkflowJobTemplate
	if row.Jobs != nil {
		_ = json.Unmarshal(row.Jobs, &jobs)
	}

	return &oapi.Workflow{
		Id:     row.ID.String(),
		Name:   row.Name,
		Inputs: inputs,
		Jobs:   jobs,
	}
}

func ToWorkflowUpsertParams(workspaceID string, e *oapi.Workflow) (db.UpsertWorkflowParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertWorkflowParams{}, fmt.Errorf("parse id: %w", err)
	}

	wid, err := uuid.Parse(workspaceID)
	if err != nil {
		return db.UpsertWorkflowParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	inputsBytes, err := json.Marshal(e.Inputs)
	if err != nil {
		return db.UpsertWorkflowParams{}, fmt.Errorf("marshal inputs: %w", err)
	}

	jobsBytes, err := json.Marshal(e.Jobs)
	if err != nil {
		return db.UpsertWorkflowParams{}, fmt.Errorf("marshal jobs: %w", err)
	}

	return db.UpsertWorkflowParams{
		ID:          id,
		Name:        e.Name,
		Inputs:      inputsBytes,
		Jobs:        jobsBytes,
		WorkspaceID: wid,
	}, nil
}

func WorkflowJobTemplateToOapi(row db.WorkflowJobTemplate) *oapi.WorkflowJobTemplate {
	var ifCond *string
	if row.IfCondition.Valid {
		ifCond = &row.IfCondition.String
	}

	var matrix *oapi.WorkflowJobMatrix
	if row.Matrix != nil {
		m := &oapi.WorkflowJobMatrix{}
		if err := json.Unmarshal(row.Matrix, m); err == nil {
			matrix = m
		}
	}

	return &oapi.WorkflowJobTemplate{
		Id:     row.ID.String(),
		Name:   row.Name,
		Ref:    row.Ref,
		Config: row.Config,
		If:     ifCond,
		Matrix: matrix,
	}
}

func ToWorkflowJobTemplateUpsertParams(workspaceID string, e *oapi.WorkflowJobTemplate) (db.UpsertWorkflowJobTemplateParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertWorkflowJobTemplateParams{}, fmt.Errorf("parse id: %w", err)
	}

	wid, err := uuid.Parse(workspaceID)
	if err != nil {
		return db.UpsertWorkflowJobTemplateParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	var ifCondition pgtype.Text
	if e.If != nil {
		ifCondition = pgtype.Text{String: *e.If, Valid: true}
	}

	var matrixBytes []byte
	if e.Matrix != nil {
		matrixBytes, err = json.Marshal(e.Matrix)
		if err != nil {
			return db.UpsertWorkflowJobTemplateParams{}, fmt.Errorf("marshal matrix: %w", err)
		}
	}

	return db.UpsertWorkflowJobTemplateParams{
		ID:          id,
		Name:        e.Name,
		Ref:         e.Ref,
		Config:      e.Config,
		IfCondition: ifCondition,
		Matrix:      matrixBytes,
		WorkspaceID: wid,
	}, nil
}

func WorkflowRunToOapi(row db.WorkflowRun) *oapi.WorkflowRun {
	return &oapi.WorkflowRun{
		Id:         row.ID.String(),
		WorkflowId: row.WorkflowID.String(),
		Inputs:     row.Inputs,
	}
}

func ToWorkflowRunUpsertParams(e *oapi.WorkflowRun) (db.UpsertWorkflowRunParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertWorkflowRunParams{}, fmt.Errorf("parse id: %w", err)
	}

	wfid, err := uuid.Parse(e.WorkflowId)
	if err != nil {
		return db.UpsertWorkflowRunParams{}, fmt.Errorf("parse workflow_id: %w", err)
	}

	return db.UpsertWorkflowRunParams{
		ID:         id,
		WorkflowID: wfid,
		Inputs:     e.Inputs,
	}, nil
}

func WorkflowJobToOapi(row db.WorkflowJob) *oapi.WorkflowJob {
	return &oapi.WorkflowJob{
		Id:            row.ID.String(),
		WorkflowRunId: row.WorkflowRunID.String(),
		Ref:           row.Ref,
		Config:        row.Config,
		Index:         int(row.Index),
	}
}

func ToWorkflowJobUpsertParams(e *oapi.WorkflowJob) (db.UpsertWorkflowJobParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertWorkflowJobParams{}, fmt.Errorf("parse id: %w", err)
	}

	wrid, err := uuid.Parse(e.WorkflowRunId)
	if err != nil {
		return db.UpsertWorkflowJobParams{}, fmt.Errorf("parse workflow_run_id: %w", err)
	}

	return db.UpsertWorkflowJobParams{
		ID:            id,
		WorkflowRunID: wrid,
		Ref:           e.Ref,
		Config:        e.Config,
		Index:         int32(e.Index),
	}, nil
}
