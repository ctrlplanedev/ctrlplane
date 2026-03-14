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

// Plannable is optionally implemented by a Dispatchable to compute the
// rendered deployment output without dispatching a job. The reconciler
// uses this to detect whether a version change would produce a different
// deployed state for a given release target.
type Plannable interface {
	Plan(ctx context.Context, dispatchCtx *oapi.DispatchContext) (*PlanResult, error)
}

type PlanResult struct {
	// ContentHash is a deterministic hash of the rendered deployment output.
	// Two plans with the same ContentHash produce identical deployed state.
	ContentHash string

	// HasChanges indicates whether the rendered output differs from the
	// currently deployed state. When false, the target is unaffected.
	HasChanges bool

	// Diff is an optional human-readable summary of what changed. Stored
	// for audit and displayed in the UI. May be empty for no-diff results.
	Diff string

	Current  string
	Proposed string
}
