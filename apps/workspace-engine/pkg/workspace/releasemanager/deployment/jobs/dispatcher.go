package jobs

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobdispatch"
	"workspace-engine/pkg/workspace/store"
)

// Dispatcher sends jobs to configured job agents for execution.
type Dispatcher struct {
	store *store.Store
}

// NewDispatcher creates a new job dispatcher.
func NewDispatcher(store *store.Store) *Dispatcher {
	return &Dispatcher{
		store: store,
	}
}

// ErrUnsupportedJobAgent is returned when a job agent type is not supported.
var ErrUnsupportedJobAgent = errors.New("job agent not supported")

// DispatchJob sends a job to the configured job agent for execution.
func (d *Dispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	jobAgent, exists := d.store.JobAgents.Get(job.JobAgentId)
	if !exists {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	if jobAgent.Type == string(jobdispatch.JobAgentTypeGithub) {
		return jobdispatch.NewGithubDispatcher(d.store.Repo()).DispatchJob(ctx, job)
	}

	return ErrUnsupportedJobAgent
}

