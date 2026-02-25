package userapprovalrecords

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Repo struct {
	ctx context.Context
}

func NewRepo(ctx context.Context) *Repo {
	return &Repo{ctx: ctx}
}

func (r *Repo) Get(key string) (*oapi.UserApprovalRecord, bool) {
	versionID, userID, environmentID, err := parseKey(key)
	if err != nil {
		log.Warn("Failed to parse user approval record key", "key", key, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetUserApprovalRecord(r.ctx, db.GetUserApprovalRecordParams{
		VersionID:     versionID,
		UserID:        userID,
		EnvironmentID: environmentID,
	})
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Warn("Failed to get user approval record", "key", key, "error", err)
		}
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.UserApprovalRecord) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	return db.GetQueries(r.ctx).UpsertUserApprovalRecord(r.ctx, params)
}

func (r *Repo) Remove(key string) error {
	versionID, userID, environmentID, err := parseKey(key)
	if err != nil {
		return fmt.Errorf("parse key: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteUserApprovalRecord(r.ctx, db.DeleteUserApprovalRecordParams{
		VersionID:     versionID,
		UserID:        userID,
		EnvironmentID: environmentID,
	})
}

func (r *Repo) Items() map[string]*oapi.UserApprovalRecord {
	log.Warn("UserApprovalRecords.Items() called on DB repo — not scoped, returning empty map")
	return make(map[string]*oapi.UserApprovalRecord)
}

func (r *Repo) GetApprovedByVersionAndEnvironment(versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	vid, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version_id: %w", err)
	}
	eid, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListApprovedRecordsByVersionAndEnvironment(r.ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
		VersionID:     vid,
		EnvironmentID: eid,
	})
	if err != nil {
		return nil, fmt.Errorf("list approved records: %w", err)
	}

	records := make([]*oapi.UserApprovalRecord, len(rows))
	for i, row := range rows {
		records[i] = ToOapi(row)
	}
	return records, nil
}
