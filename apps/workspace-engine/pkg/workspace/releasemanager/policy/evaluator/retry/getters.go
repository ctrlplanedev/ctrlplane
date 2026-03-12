package retry

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Getters interface {
	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
}
