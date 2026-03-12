package approval

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type Getters interface {
	GetApprovalRecords(
		ctx context.Context,
		versionID, environmentID string,
	) ([]*oapi.UserApprovalRecord, error)
}

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{queries: queries}
}

func (g *PostgresGetters) GetApprovalRecords(
	ctx context.Context,
	versionID, environmentID string,
) ([]*oapi.UserApprovalRecord, error) {
	records, err := g.queries.ListApprovedRecordsByVersionAndEnvironment(
		ctx,
		db.ListApprovedRecordsByVersionAndEnvironmentParams{
			VersionID:     uuid.MustParse(versionID),
			EnvironmentID: uuid.MustParse(environmentID),
		},
	)
	if err != nil {
		return nil, err
	}
	recordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(records))
	for _, record := range records {
		recordsOAPI = append(recordsOAPI, db.ToOapiUserApprovalRecord(record))
	}
	return recordsOAPI, nil
}
