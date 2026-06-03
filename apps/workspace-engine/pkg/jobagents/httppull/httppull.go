package httppull

import (
	"context"

	"workspace-engine/pkg/jobagents/types"
	"workspace-engine/pkg/oapi"
)

var _ types.Dispatchable = &HTTPPull{}

// HTTPPull is the job agent for external providers that pull their jobs over
// HTTP rather than having ctrlplane push work into their environment. It does
// not execute anything: dispatching only marks the job claimable by moving it
// to the queued state, where it waits for the external agent to claim it via
// the pull API.
type HTTPPull struct {
	setter Setter
}

type Setter interface {
	UpdateJob(
		ctx context.Context,
		jobID string,
		status oapi.JobStatus,
		message string,
		metadata map[string]string,
	) error
}

func New(setter Setter) *HTTPPull {
	return &HTTPPull{setter: setter}
}

func (h *HTTPPull) Type() string {
	return "http-pull"
}

// Dispatch publishes the job to the pull queue by marking it queued. There is
// no push to an external system; the external agent takes the job from here by
// claiming it.
func (h *HTTPPull) Dispatch(ctx context.Context, job *oapi.Job) error {
	return h.setter.UpdateJob(ctx, job.Id, oapi.JobStatusQueued, "", nil)
}
