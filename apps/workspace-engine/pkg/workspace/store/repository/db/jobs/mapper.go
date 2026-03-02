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

type jobRow struct {
	ID              uuid.UUID
	JobAgentID      uuid.UUID
	JobAgentConfig  []byte
	ExternalID      pgtype.Text
	DispatchContext []byte
	Status          db.JobStatus
	Message         pgtype.Text
	CreatedAt       pgtype.Timestamptz
	StartedAt       pgtype.Timestamptz
	CompletedAt     pgtype.Timestamptz
	UpdatedAt       pgtype.Timestamptz
	ReleaseID       uuid.UUID
	Metadata        []byte
}

func fromGetRow(r db.GetJobByIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, DispatchContext: r.DispatchContext,
		Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromWorkspaceRow(r db.ListJobsByWorkspaceIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, DispatchContext: r.DispatchContext,
		Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromReleaseRow(r db.ListJobsByReleaseIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, DispatchContext: r.DispatchContext,
		Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromAgentRow(r db.ListJobsByAgentIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, DispatchContext: r.DispatchContext,
		Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

type metadataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// OapiToDBStatus maps OpenAPI camelCase job statuses to Postgres snake_case enum values.
var OapiToDBStatus = map[oapi.JobStatus]db.JobStatus{
	oapi.JobStatusCancelled:           db.JobStatusCancelled,
	oapi.JobStatusSkipped:             db.JobStatusSkipped,
	oapi.JobStatusInProgress:          db.JobStatusInProgress,
	oapi.JobStatusActionRequired:      db.JobStatusActionRequired,
	oapi.JobStatusPending:             db.JobStatusPending,
	oapi.JobStatusFailure:             db.JobStatusFailure,
	oapi.JobStatusInvalidJobAgent:     db.JobStatusInvalidJobAgent,
	oapi.JobStatusInvalidIntegration:  db.JobStatusInvalidIntegration,
	oapi.JobStatusExternalRunNotFound: db.JobStatusExternalRunNotFound,
	oapi.JobStatusSuccessful:          db.JobStatusSuccessful,
}

// DBToOapiStatus maps Postgres snake_case enum values to OpenAPI camelCase job statuses.
var DBToOapiStatus = map[db.JobStatus]oapi.JobStatus{
	db.JobStatusCancelled:           oapi.JobStatusCancelled,
	db.JobStatusSkipped:             oapi.JobStatusSkipped,
	db.JobStatusInProgress:          oapi.JobStatusInProgress,
	db.JobStatusActionRequired:      oapi.JobStatusActionRequired,
	db.JobStatusPending:             oapi.JobStatusPending,
	db.JobStatusFailure:             oapi.JobStatusFailure,
	db.JobStatusInvalidJobAgent:     oapi.JobStatusInvalidJobAgent,
	db.JobStatusInvalidIntegration:  oapi.JobStatusInvalidIntegration,
	db.JobStatusExternalRunNotFound: oapi.JobStatusExternalRunNotFound,
	db.JobStatusSuccessful:          oapi.JobStatusSuccessful,
}

func ToOapi(row jobRow) *oapi.Job {
	config := make(oapi.JobAgentConfig)
	if len(row.JobAgentConfig) > 0 {
		_ = json.Unmarshal(row.JobAgentConfig, &config)
	}

	metadata := make(map[string]string)
	if len(row.Metadata) > 0 {
		var entries []metadataEntry
		if err := json.Unmarshal(row.Metadata, &entries); err == nil {
			for _, e := range entries {
				metadata[e.Key] = e.Value
			}
		}
	}

	var dc *oapi.DispatchContext
	if len(row.DispatchContext) > 0 && string(row.DispatchContext) != "{}" {
		dc = &oapi.DispatchContext{}
		if err := json.Unmarshal(row.DispatchContext, dc); err != nil {
			dc = nil
		}
	}

	var jobAgentId string
	if row.JobAgentID != uuid.Nil {
		jobAgentId = row.JobAgentID.String()
	}

	j := &oapi.Job{
		Id:              row.ID.String(),
		JobAgentId:      jobAgentId,
		JobAgentConfig:  config,
		DispatchContext: dc,
		Status:          DBToOapiStatus[row.Status],
		ReleaseId:       row.ReleaseID.String(),
		Metadata:        metadata,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}

	if row.ExternalID.Valid {
		j.ExternalId = &row.ExternalID.String
	}
	if row.Message.Valid {
		j.Message = &row.Message.String
	}
	if row.StartedAt.Valid {
		t := row.StartedAt.Time
		j.StartedAt = &t
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		j.CompletedAt = &t
	}

	if dc != nil && dc.WorkflowJob != nil && j.WorkflowJobId == "" {
		j.WorkflowJobId = dc.WorkflowJob.Id
	}

	return j
}

func ToUpsertParams(j *oapi.Job) (db.UpsertJobParams, error) {
	id, err := uuid.Parse(j.Id)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse job id: %w", err)
	}

	var agentID uuid.UUID
	if j.JobAgentId != "" {
		agentID, err = uuid.Parse(j.JobAgentId)
		if err != nil {
			return db.UpsertJobParams{}, fmt.Errorf("parse job_agent_id: %w", err)
		}
	}

	agentConfig, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("marshal job_agent_config: %w", err)
	}

	dcBytes := []byte("{}")
	if j.DispatchContext != nil {
		if b, err := json.Marshal(j.DispatchContext); err == nil {
			dcBytes = b
		}
	}

	params := db.UpsertJobParams{
		ID:              id,
		JobAgentID:      agentID,
		JobAgentConfig:  agentConfig,
		DispatchContext: dcBytes,
		Status:          OapiToDBStatus[j.Status],
		CreatedAt:       pgtype.Timestamptz{Time: j.CreatedAt, Valid: !j.CreatedAt.IsZero()},
		UpdatedAt:       pgtype.Timestamptz{Time: j.UpdatedAt, Valid: !j.UpdatedAt.IsZero()},
	}

	if j.ExternalId != nil {
		params.ExternalID = pgtype.Text{String: *j.ExternalId, Valid: true}
	}
	if j.Message != nil {
		params.Message = pgtype.Text{String: *j.Message, Valid: true}
	}
	if j.StartedAt != nil {
		params.StartedAt = pgtype.Timestamptz{Time: *j.StartedAt, Valid: true}
	}
	if j.CompletedAt != nil {
		params.CompletedAt = pgtype.Timestamptz{Time: *j.CompletedAt, Valid: true}
	}

	if params.CreatedAt.Time.IsZero() {
		params.CreatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}
	if params.UpdatedAt.Time.IsZero() {
		params.UpdatedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}

	return params, nil
}
