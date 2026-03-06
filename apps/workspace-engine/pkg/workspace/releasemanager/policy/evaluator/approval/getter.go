package approval

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type Getters interface {
	GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error)
}

var _ Getters = (*StoreGetters)(nil)

func NewStoreGetters(store *store.Store) *StoreGetters {
	return &StoreGetters{store: store}
}

type StoreGetters struct {
	store *store.Store
}

func (s *StoreGetters) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	records := s.store.UserApprovalRecords.GetApprovalRecords(versionID, environmentID)
	return records, nil
}

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{queries: queries}
}

func (g *PostgresGetters) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	records, err := g.queries.ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
		VersionID:     uuid.MustParse(versionID),
		EnvironmentID: uuid.MustParse(environmentID),
	})
	if err != nil {
		return nil, err
	}
	recordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(records))
	for _, record := range records {
		recordsOAPI = append(recordsOAPI, db.ToOapiUserApprovalRecord(record))
	}
	return recordsOAPI, nil
}
