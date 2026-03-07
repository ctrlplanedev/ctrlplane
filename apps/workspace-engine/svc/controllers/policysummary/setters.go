package policysummary

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type RuleSummaryRow struct {
	RuleID        uuid.UUID
	EnvironmentID uuid.UUID
	VersionID     uuid.UUID
	Evaluation    *oapi.RuleEvaluation
}

type Setter interface {
	UpsertRuleSummaries(ctx context.Context, rows []RuleSummaryRow) error
}
