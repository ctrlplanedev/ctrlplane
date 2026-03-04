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
	JobAgentID      pgtype.UUID
	JobAgentConfig  []byte
	ExternalID      pgtype.Text
	Status          db.JobStatus
	Message         pgtype.Text
	CreatedAt       pgtype.Timestamptz
	StartedAt       pgtype.Timestamptz
	CompletedAt     pgtype.Timestamptz
	UpdatedAt       pgtype.Timestamptz
	DispatchContext []byte
	ReleaseID       uuid.UUID
	Metadata        []byte
}

func fromGetRow(r db.GetJobByIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, DispatchContext: r.DispatchContext,
		ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromWorkspaceRow(r db.ListJobsByWorkspaceIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, DispatchContext: r.DispatchContext,
		ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromAgentRow(r db.ListJobsByAgentIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, DispatchContext: r.DispatchContext,
		ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromReleaseRow(r db.ListJobsByReleaseIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, DispatchContext: r.DispatchContext,
		ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

type metadataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

var dbToOapiStatus = map[db.JobStatus]oapi.JobStatus{
	"cancelled":              oapi.JobStatusCancelled,
	"skipped":                oapi.JobStatusSkipped,
	"in_progress":            oapi.JobStatusInProgress,
	"action_required":        oapi.JobStatusActionRequired,
	"pending":                oapi.JobStatusPending,
	"failure":                oapi.JobStatusFailure,
	"invalid_job_agent":      oapi.JobStatusInvalidJobAgent,
	"invalid_integration":    oapi.JobStatusInvalidIntegration,
	"external_run_not_found": oapi.JobStatusExternalRunNotFound,
	"successful":             oapi.JobStatusSuccessful,
}

var oapiToDBStatus = map[oapi.JobStatus]db.JobStatus{
	oapi.JobStatusCancelled:           "cancelled",
	oapi.JobStatusSkipped:             "skipped",
	oapi.JobStatusInProgress:          "in_progress",
	oapi.JobStatusActionRequired:      "action_required",
	oapi.JobStatusPending:             "pending",
	oapi.JobStatusFailure:             "failure",
	oapi.JobStatusInvalidJobAgent:     "invalid_job_agent",
	oapi.JobStatusInvalidIntegration:  "invalid_integration",
	oapi.JobStatusExternalRunNotFound: "external_run_not_found",
	oapi.JobStatusSuccessful:          "successful",
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

	var dispatchContext *oapi.DispatchContext
	if len(row.DispatchContext) > 0 {
		dc := &oapi.DispatchContext{}
		if err := json.Unmarshal(row.DispatchContext, dc); err == nil {
			dispatchContext = dc
		}
	}

	var jobAgentId string
	if row.JobAgentID.Valid {
		jobAgentId = uuid.UUID(row.JobAgentID.Bytes).String()
	}

	j := &oapi.Job{
		Id:              row.ID.String(),
		JobAgentId:      jobAgentId,
		JobAgentConfig:  config,
		Status:          dbToOapiStatus[row.Status],
		ReleaseId:       row.ReleaseID.String(),
		Metadata:        metadata,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
		DispatchContext: dispatchContext,
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

	return j
}

func ToUpsertParams(j *oapi.Job) (db.UpsertJobParams, error) {
	id, err := uuid.Parse(j.Id)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse job id: %w", err)
	}

	var agentID pgtype.UUID
	if j.JobAgentId != "" {
		parsed, err := uuid.Parse(j.JobAgentId)
		if err != nil {
			return db.UpsertJobParams{}, fmt.Errorf("parse job_agent_id: %w", err)
		}
		agentID = pgtype.UUID{Bytes: parsed, Valid: true}
	}

	agentConfig, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("marshal job_agent_config: %w", err)
	}

	dispatchContextBytes := []byte("{}")
	if j.DispatchContext != nil {
		var err error
		dispatchContextBytes, err = json.Marshal(j.DispatchContext)
		if err != nil {
			return db.UpsertJobParams{}, fmt.Errorf("marshal dispatch_context: %w", err)
		}
	}

	params := db.UpsertJobParams{
		ID:              id,
		JobAgentID:      agentID,
		JobAgentConfig:  agentConfig,
		Status:          oapiToDBStatus[j.Status],
		CreatedAt:       pgtype.Timestamptz{Time: j.CreatedAt, Valid: !j.CreatedAt.IsZero()},
		UpdatedAt:       pgtype.Timestamptz{Time: j.UpdatedAt, Valid: !j.UpdatedAt.IsZero()},
		DispatchContext: dispatchContextBytes,
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
