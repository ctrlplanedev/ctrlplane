package types

import (
	"context"
	"encoding/json"
	"time"

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

// Plannable is optionally implemented by a Dispatchable to compute the
// rendered deployment output without dispatching a job. Agents may require
// multiple calls to complete (e.g. waiting for manifests to render).
// Between calls the reconciler persists State so the agent can resume.
type Plannable interface {
	Plan(ctx context.Context, dispatchCtx *oapi.DispatchContext, state json.RawMessage) (*PlanResult, error)
}

type PlanResult struct {
	ContentHash string
	HasChanges  bool
	Current     string
	Proposed    string

	// CompletedAt is nil while the agent still needs more calls.
	// The reconciler persists State and requeues when nil, and
	// writes the final result when non-nil.
	CompletedAt *time.Time

	// State is an opaque agent checkpoint persisted between calls.
	State json.RawMessage
}
