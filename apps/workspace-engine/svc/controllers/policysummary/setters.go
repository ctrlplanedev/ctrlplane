package policysummary

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// RuleSummaryRow is the DB representation of a single rule evaluation result.
type RuleSummaryRow struct {
	WorkspaceID   uuid.UUID
	PolicyID      uuid.UUID
	RuleID        string
	RuleType      string
	DeploymentID  *uuid.UUID
	EnvironmentID *uuid.UUID
	VersionID     *uuid.UUID
	Evaluation    *oapi.RuleEvaluation
}

type Setter interface {
	UpsertRuleSummaries(ctx context.Context, rows []RuleSummaryRow) error
}
