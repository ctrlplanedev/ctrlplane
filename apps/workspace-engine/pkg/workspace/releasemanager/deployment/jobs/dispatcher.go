package jobs

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobdispatch"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"
)

// Dispatcher sends jobs to configured job agents for execution.
type Dispatcher struct {
	store        *store.Store
	verification *verification.Manager
}

// NewDispatcher creates a new job dispatcher.
func NewDispatcher(store *store.Store, verification *verification.Manager) *Dispatcher {
	return &Dispatcher{
		store:        store,
		verification: verification,
	}
}

// ErrUnsupportedJobAgent is returned when a job agent type is not supported.
var ErrUnsupportedJobAgent = errors.New("job agent not supported")

// DispatchJob sends a job to the configured job agent for execution.
func (d *Dispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	_, exists := d.store.JobAgents.Get(job.JobAgentId)
	if !exists {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	if _, err := job.GetArgoCDJobAgentConfig(); err == nil {
		return jobdispatch.NewArgoCDDispatcher(d.store, d.verification).DispatchJob(ctx, job)
	}

	if _, err := job.GetGithubJobAgentConfig(); err == nil {
		return jobdispatch.NewGithubDispatcher(d.store).DispatchJob(ctx, job)
	}

	if _, err := job.GetTerraformCloudJobAgentConfig(); err == nil {
		return jobdispatch.NewTerraformCloudDispatcher(d.store, d.verification).DispatchJob(ctx, job)
	}

	if _, err := job.GetTestRunnerJobAgentConfig(); err == nil {
		return jobdispatch.NewTestRunnerDispatcher(d.store).DispatchJob(ctx, job)
	}

	// Custom job agents handle job processing themselves - no dispatch needed
	return nil
}
