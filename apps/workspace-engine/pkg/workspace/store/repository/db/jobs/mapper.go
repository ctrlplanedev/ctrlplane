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
	ID             uuid.UUID
	JobAgentID     uuid.UUID
	JobAgentConfig []byte
	ExternalID     pgtype.Text
	Status         db.JobStatus
	Message        pgtype.Text
	CreatedAt      pgtype.Timestamptz
	StartedAt      pgtype.Timestamptz
	CompletedAt    pgtype.Timestamptz
	UpdatedAt      pgtype.Timestamptz
	ReleaseID      uuid.UUID
	Metadata       []byte
}

func fromGetRow(r db.GetJobByIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromWorkspaceRow(r db.ListJobsByWorkspaceIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

func fromAgentRow(r db.ListJobsByAgentIDRow) jobRow {
	return jobRow{
		ID: r.ID, JobAgentID: r.JobAgentID, JobAgentConfig: r.JobAgentConfig,
		ExternalID: r.ExternalID, Status: r.Status, Message: r.Message,
		CreatedAt: r.CreatedAt, StartedAt: r.StartedAt, CompletedAt: r.CompletedAt,
		UpdatedAt: r.UpdatedAt, ReleaseID: r.ReleaseID, Metadata: r.Metadata,
	}
}

type metadataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
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

	j := &oapi.Job{
		Id:             row.ID.String(),
		JobAgentId:     row.JobAgentID.String(),
		JobAgentConfig: config,
		Status:         oapi.JobStatus(row.Status),
		ReleaseId:      row.ReleaseID.String(),
		Metadata:       metadata,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
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

	agentID, err := uuid.Parse(j.JobAgentId)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("parse job_agent_id: %w", err)
	}

	agentConfig, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return db.UpsertJobParams{}, fmt.Errorf("marshal job_agent_config: %w", err)
	}

	params := db.UpsertJobParams{
		ID:             id,
		JobAgentID:     agentID,
		JobAgentConfig: agentConfig,
		Status:         db.JobStatus(j.Status),
		CreatedAt:      pgtype.Timestamptz{Time: j.CreatedAt, Valid: !j.CreatedAt.IsZero()},
		UpdatedAt:      pgtype.Timestamptz{Time: j.UpdatedAt, Valid: !j.UpdatedAt.IsZero()},
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
