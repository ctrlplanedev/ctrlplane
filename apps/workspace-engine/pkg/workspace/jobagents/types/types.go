package types

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, job *oapi.Job) error
}

// Restorable is implemented by dispatchers that can resume tracking
// in-flight jobs after an engine restart. Jobs with an ExternalId are
// resumed; jobs without one are marked as externalRunNotFound.
type Restorable interface {
	RestoreJobs(ctx context.Context, jobs []*oapi.Job) error
}
