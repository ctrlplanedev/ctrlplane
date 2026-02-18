package resourceproviders

import (
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"
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
		WorkspaceId: openapi_types.UUID(row.WorkspaceID),
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

	wsID := uuid.UUID(rp.WorkspaceId)

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
