package jobeligibility

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct {
	Queue reconcile.Queue
}

func (s *PostgresSetter) CreateJob(ctx context.Context, job *oapi.Job) error {
	return fmt.Errorf("not implemented")
}

func (s *PostgresSetter) EnqueueJobDispatch(ctx context.Context, workspaceID string, jobID string) error {
	return s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "job-dispatch",
		ScopeType:   "job",
		ScopeID:     jobID,
	})
}
