package resources

import (
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func timestamptzToTimePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}

func timePtrToTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

// ResourceRow is the canonical row type returned by resource SELECT queries.
// All per-query row types (e.g. db.ListResourcesByIdentifiersRow) share
// the same structure and can be converted to this type.
type ResourceRow = db.GetResourceByIDRow

// ToOapi converts a resource row into an oapi.Resource.
func ToOapi(row ResourceRow) *oapi.Resource {
	config := row.Config
	if config == nil {
		config = make(map[string]any)
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	var createdAt time.Time
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}

	var providerID *string
	if row.ProviderID != uuid.Nil {
		s := row.ProviderID.String()
		providerID = &s
	}

	return &oapi.Resource{
		Id:          row.ID.String(),
		Version:     row.Version,
		Name:        row.Name,
		Kind:        row.Kind,
		Identifier:  row.Identifier,
		ProviderId:  providerID,
		WorkspaceId: row.WorkspaceID.String(),
		Config:      config,
		CreatedAt:   createdAt,
		UpdatedAt:   timestamptzToTimePtr(row.UpdatedAt),
		DeletedAt:   timestamptzToTimePtr(row.DeletedAt),
		Metadata:    metadata,
	}
}

// ToSummary converts a lightweight summary row into a ResourceSummary.
func ToSummary(row db.ListResourceSummariesByIdentifiersRow) *repository.ResourceSummary {
	var createdAt time.Time
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}

	var providerID *string
	if row.ProviderID != uuid.Nil {
		s := row.ProviderID.String()
		providerID = &s
	}

	return &repository.ResourceSummary{
		Id:         row.ID.String(),
		Identifier: row.Identifier,
		ProviderId: providerID,
		Version:    row.Version,
		Name:       row.Name,
		Kind:       row.Kind,
		CreatedAt:  createdAt,
		UpdatedAt:  timestamptzToTimePtr(row.UpdatedAt),
	}
}

// ToUpsertParams converts an oapi.Resource into sqlc upsert params.
func ToUpsertParams(r *oapi.Resource) (db.UpsertResourceParams, error) {
	id, err := uuid.Parse(r.Id)
	if err != nil {
		return db.UpsertResourceParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(r.WorkspaceId)
	if err != nil {
		return db.UpsertResourceParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	var providerID uuid.UUID
	if r.ProviderId != nil {
		parsed, err := uuid.Parse(*r.ProviderId)
		if err != nil {
			return db.UpsertResourceParams{}, fmt.Errorf("parse provider_id: %w", err)
		}
		providerID = parsed
	}

	config := r.Config
	if config == nil {
		config = make(map[string]any)
	}

	metadata := r.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	createdAt := pgtype.Timestamptz{Time: r.CreatedAt, Valid: !r.CreatedAt.IsZero()}

	return db.UpsertResourceParams{
		ID:          id,
		Version:     r.Version,
		Name:        r.Name,
		Kind:        r.Kind,
		Identifier:  r.Identifier,
		ProviderID:  providerID,
		WorkspaceID: wsID,
		Config:      config,
		CreatedAt:   createdAt,
		UpdatedAt:   timePtrToTimestamptz(r.UpdatedAt),
		DeletedAt:   timePtrToTimestamptz(r.DeletedAt),
		Metadata:    metadata,
	}, nil
}

// ToBatchUpsertParams converts an oapi.Resource into sqlc batch upsert params.
func ToBatchUpsertParams(r *oapi.Resource) (db.BatchUpsertResourceParams, error) {
	id, err := uuid.Parse(r.Id)
	if err != nil {
		return db.BatchUpsertResourceParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(r.WorkspaceId)
	if err != nil {
		return db.BatchUpsertResourceParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	var providerID uuid.UUID
	if r.ProviderId != nil {
		parsed, err := uuid.Parse(*r.ProviderId)
		if err != nil {
			return db.BatchUpsertResourceParams{}, fmt.Errorf("parse provider_id: %w", err)
		}
		providerID = parsed
	}

	config := r.Config
	if config == nil {
		config = make(map[string]any)
	}

	metadata := r.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	createdAt := pgtype.Timestamptz{Time: r.CreatedAt, Valid: !r.CreatedAt.IsZero()}

	return db.BatchUpsertResourceParams{
		ID:          id,
		Version:     r.Version,
		Name:        r.Name,
		Kind:        r.Kind,
		Identifier:  r.Identifier,
		ProviderID:  providerID,
		WorkspaceID: wsID,
		Config:      config,
		CreatedAt:   createdAt,
		UpdatedAt:   timePtrToTimestamptz(r.UpdatedAt),
		DeletedAt:   timePtrToTimestamptz(r.DeletedAt),
		Metadata:    metadata,
	}, nil
}
