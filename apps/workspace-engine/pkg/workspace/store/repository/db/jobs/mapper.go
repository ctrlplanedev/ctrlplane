package jobs

import (
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var oapiToDBStatus = map[oapi.JobStatus]db.JobStatus{
	oapi.JobStatusActionRequired:      db.JobStatusActionRequired,
	oapi.JobStatusCancelled:           db.JobStatusCancelled,
	oapi.JobStatusExternalRunNotFound: db.JobStatusExternalRunNotFound,
	oapi.JobStatusFailure:             db.JobStatusFailure,
	oapi.JobStatusInProgress:          db.JobStatusInProgress,
	oapi.JobStatusInvalidIntegration:  db.JobStatusInvalidIntegration,
	oapi.JobStatusInvalidJobAgent:     db.JobStatusInvalidJobAgent,
	oapi.JobStatusPending:             db.JobStatusPending,
	oapi.JobStatusSkipped:             db.JobStatusSkipped,
	oapi.JobStatusSuccessful:          db.JobStatusSuccessful,
}

var dbToOapiStatus = map[db.JobStatus]oapi.JobStatus{
	db.JobStatusActionRequired:      oapi.JobStatusActionRequired,
	db.JobStatusCancelled:           oapi.JobStatusCancelled,
	db.JobStatusExternalRunNotFound: oapi.JobStatusExternalRunNotFound,
	db.JobStatusFailure:             oapi.JobStatusFailure,
	db.JobStatusInProgress:          oapi.JobStatusInProgress,
	db.JobStatusInvalidIntegration:  oapi.JobStatusInvalidIntegration,
	db.JobStatusInvalidJobAgent:     oapi.JobStatusInvalidJobAgent,
	db.JobStatusPending:             oapi.JobStatusPending,
	db.JobStatusSkipped:             oapi.JobStatusSkipped,
	db.JobStatusSuccessful:          oapi.JobStatusSuccessful,
}

func ToOapi(row db.Job) (*oapi.Job, error) {
	status, ok := dbToOapiStatus[row.Status]
	if !ok {
		return nil, fmt.Errorf("unknown job status: %s", row.Status)
	}

	job := &oapi.Job{
		Id:             row.ID.String(),
		ReleaseId:      row.ReleaseID.String(),
		JobAgentId:     row.JobAgentID.String(),
		WorkflowJobId:  row.WorkflowJobID.String(),
		Status:         status,
		JobAgentConfig: oapi.JobAgentConfig(row.JobAgentConfig),
		Metadata:       row.Metadata,
	}

	if row.ExternalID.Valid {
		job.ExternalId = &row.ExternalID.String
	}
	if row.Message.Valid {
		job.Message = &row.Message.String
	}
	if row.TraceToken.Valid {
		job.TraceToken = &row.TraceToken.String
	}
	if row.CreatedAt.Valid {
		job.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		job.UpdatedAt = row.UpdatedAt.Time
	}
	if row.StartedAt.Valid {
		t := row.StartedAt.Time
		job.StartedAt = &t
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		job.CompletedAt = &t
	}

	if row.DispatchContext != nil {
		var dc oapi.DispatchContext
		if err := json.Unmarshal(row.DispatchContext, &dc); err != nil {
			return nil, fmt.Errorf("unmarshal dispatch_context: %w", err)
		}
		job.DispatchContext = &dc
	}

	if job.Metadata == nil {
		job.Metadata = make(map[string]string)
	}

	return job, nil
}

func ToUpsertParams(job *oapi.Job) (db.UpsertJobParams, error) {
	id, err := uuid.Parse(job.Id)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse job id: %w", err)
	}
	releaseID, err := uuid.Parse(job.ReleaseId)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse release_id: %w", err)
	}
	jobAgentID, err := uuid.Parse(job.JobAgentId)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse job_agent_id: %w", err)
	}
	workflowJobID, err := uuid.Parse(job.WorkflowJobId)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse workflow_job_id: %w", err)
	}

	dbStatus, ok := oapiToDBStatus[job.Status]
	if !ok {
		return db.UpsertJobParams{}, fmt.Errorf("unknown job status: %s", job.Status)
	}

	params := db.UpsertJobParams{
		ID:            id,
		ReleaseID:     releaseID,
		JobAgentID:    jobAgentID,
		WorkflowJobID: workflowJobID,
		Status:        dbStatus,
		Reason:        "policy_passing",
		JobAgentConfig: map[string]any(job.JobAgentConfig),
		Metadata:       job.Metadata,
		CreatedAt:      pgtype.Timestamptz{Time: job.CreatedAt, Valid: !job.CreatedAt.IsZero()},
		UpdatedAt:      pgtype.Timestamptz{Time: job.UpdatedAt, Valid: !job.UpdatedAt.IsZero()},
	}

	if job.ExternalId != nil {
		params.ExternalID = pgtype.Text{String: *job.ExternalId, Valid: true}
	}
	if job.Message != nil {
		params.Message = pgtype.Text{String: *job.Message, Valid: true}
	}
	if job.TraceToken != nil {
		params.TraceToken = pgtype.Text{String: *job.TraceToken, Valid: true}
	}
	if job.StartedAt != nil {
		params.StartedAt = pgtype.Timestamptz{Time: *job.StartedAt, Valid: true}
	}
	if job.CompletedAt != nil {
		params.CompletedAt = pgtype.Timestamptz{Time: *job.CompletedAt, Valid: true}
	}

	if job.DispatchContext != nil {
		dcBytes, err := json.Marshal(job.DispatchContext)
		if err != nil {
			return db.UpsertJobParams{}, fmt.Errorf("marshal dispatch_context: %w", err)
		}
		params.DispatchContext = dcBytes
	}

	if params.Metadata == nil {
		params.Metadata = make(map[string]string)
	}
	if params.CreatedAt.Time.IsZero() {
		params.CreatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}
	if params.UpdatedAt.Time.IsZero() {
		params.UpdatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}

	return params, nil
}
