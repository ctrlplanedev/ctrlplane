package jobeligibility

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Setter interface {
	CreateJob(ctx context.Context, job *oapi.Job, release *oapi.Release) error
	EnqueueJobDispatch(ctx context.Context, workspaceID string, jobID string) error
}
