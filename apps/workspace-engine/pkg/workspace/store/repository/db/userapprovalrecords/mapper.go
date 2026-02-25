package userapprovalrecords

import (
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func ToOapi(row db.UserApprovalRecord) *oapi.UserApprovalRecord {
	var reason *string
	if row.Reason.Valid {
		reason = &row.Reason.String
	}

	return &oapi.UserApprovalRecord{
		VersionId:     row.VersionID.String(),
		UserId:        row.UserID.String(),
		EnvironmentId: row.EnvironmentID.String(),
		Status:        oapi.ApprovalStatus(row.Status),
		Reason:        reason,
		CreatedAt:     row.CreatedAt.Time.Format(time.RFC3339),
	}
}

func ToUpsertParams(e *oapi.UserApprovalRecord) (db.UpsertUserApprovalRecordParams, error) {
	vid, err := uuid.Parse(e.VersionId)
	if err != nil {
		return db.UpsertUserApprovalRecordParams{}, fmt.Errorf("parse version_id: %w", err)
	}
	uid, err := uuid.Parse(e.UserId)
	if err != nil {
		return db.UpsertUserApprovalRecordParams{}, fmt.Errorf("parse user_id: %w", err)
	}
	eid, err := uuid.Parse(e.EnvironmentId)
	if err != nil {
		return db.UpsertUserApprovalRecordParams{}, fmt.Errorf("parse environment_id: %w", err)
	}

	var reason pgtype.Text
	if e.Reason != nil {
		reason = pgtype.Text{String: *e.Reason, Valid: true}
	}

	var createdAt pgtype.Timestamptz
	if e.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, e.CreatedAt)
		if err != nil {
			return db.UpsertUserApprovalRecordParams{}, fmt.Errorf("parse created_at %q: %w", e.CreatedAt, err)
		}
		createdAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	return db.UpsertUserApprovalRecordParams{
		VersionID:     vid,
		UserID:        uid,
		EnvironmentID: eid,
		Status:        string(e.Status),
		Reason:        reason,
		CreatedAt:     createdAt,
	}, nil
}

func parseKey(key string) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	if len(key) < 108 {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("key too short: %q", key)
	}
	vid, err := uuid.Parse(key[:36])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse version_id from key: %w", err)
	}
	uid, err := uuid.Parse(key[36:72])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse user_id from key: %w", err)
	}
	eid, err := uuid.Parse(key[72:108])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse environment_id from key: %w", err)
	}
	return vid, uid, eid, nil
}
