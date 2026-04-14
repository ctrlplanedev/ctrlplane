package forcedeploy

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Setter interface {
	CreateJobAndEnqueueDispatch(
		ctx context.Context,
		job *oapi.Job,
		release *oapi.Release,
		workspaceID string,
	) error
}
