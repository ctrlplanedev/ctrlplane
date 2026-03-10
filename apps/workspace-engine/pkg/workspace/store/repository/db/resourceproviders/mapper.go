package resourceproviders

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

// ToOapi converts a db.ResourceProvider into an oapi.ResourceProvider.
func ToOapi(row db.ResourceProvider) *oapi.ResourceProvider {
	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	var createdAt time.Time
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}

	return &oapi.ResourceProvider{
		Id:          row.ID.String(),
		Name:        row.Name,
		WorkspaceId: row.WorkspaceID,
		CreatedAt:   createdAt,
		Metadata:    metadata,
	}
}

// ToUpsertParams converts an oapi.ResourceProvider into sqlc upsert params.
func ToUpsertParams(rp *oapi.ResourceProvider) (db.UpsertResourceProviderParams, error) {
	id, err := uuid.Parse(rp.Id)
	if err != nil {
		return db.UpsertResourceProviderParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID := rp.WorkspaceId

	metadata := rp.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	createdAt := pgtype.Timestamptz{Time: rp.CreatedAt, Valid: !rp.CreatedAt.IsZero()}

	return db.UpsertResourceProviderParams{
		ID:          id,
		Name:        rp.Name,
		WorkspaceID: wsID,
		CreatedAt:   createdAt,
		Metadata:    metadata,
	}, nil
}
