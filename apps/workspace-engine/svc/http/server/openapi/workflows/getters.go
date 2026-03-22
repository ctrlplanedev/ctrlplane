package workflows

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Getter interface {
	GetWorkflowByID(ctx context.Context, workflowID string) (*oapi.Workflow, error)
}
