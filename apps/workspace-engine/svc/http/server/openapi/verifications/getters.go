package verifications

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type Getter interface {
	GetJobVerificationStatus(ctx context.Context, jobID string) (string, error)
}

type PostgresGetter struct{}

var _ Getter = &PostgresGetter{}

func (g *PostgresGetter) GetJobVerificationStatus(
	ctx context.Context,
	jobID string,
) (string, error) {
	id, err := uuid.Parse(jobID)
	if err != nil {
		return "", fmt.Errorf("invalid job id: %w", err)
	}

	queries := db.GetQueries(ctx)
	status, err := queries.GetAggregateJobVerificationStatus(ctx, id)
	if err != nil {
		return "", fmt.Errorf("get aggregate verification status: %w", err)
	}

	return status, nil
}
