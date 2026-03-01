package types

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, job *oapi.Job) error
}

// Verifiable is optionally implemented by a Dispatchable to declare the
// verification metric specs it requires. The reconciler calls this before
// job creation so that verification records are persisted atomically with
// the job.
type Verifiable interface {
	Verifications(config oapi.JobAgentConfig) ([]oapi.VerificationMetricSpec, error)
}
