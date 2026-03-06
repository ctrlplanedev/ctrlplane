package approval

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type postgresGetters struct {
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *postgresGetters {
	return &postgresGetters{queries: queries}
}

func (g *postgresGetters) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	approvalRecords, err := db.GetQueries(ctx).ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
		VersionID:     uuid.MustParse(versionID),
		EnvironmentID: uuid.MustParse(environmentID),
	})
	if err != nil {
		return nil, fmt.Errorf("list approval records for workspace %s: %w", versionID, err)
	}
	approvalRecordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(approvalRecords))
	for _, approvalRecord := range approvalRecords {
		approvalRecordsOAPI = append(approvalRecordsOAPI, db.ToOapiUserApprovalRecord(approvalRecord))
	}
	return approvalRecordsOAPI, nil
}
