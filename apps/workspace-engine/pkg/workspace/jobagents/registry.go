package jobagents

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents/argo"
	"workspace-engine/pkg/workspace/jobagents/github"
	"workspace-engine/pkg/workspace/jobagents/terraformcloud"
	"workspace-engine/pkg/workspace/jobagents/testrunner"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
)

type Registry struct {
	dispatchers map[string]types.Dispatchable
	store       *store.Store
}

func NewRegistry(store *store.Store, verifications *verification.Manager) *Registry {
	r := &Registry{}
	r.dispatchers = make(map[string]types.Dispatchable)
	r.store = store

	r.Register(testrunner.New(store))
	r.Register(argo.NewArgoApplication(store, verifications))
	r.Register(terraformcloud.NewTFE(store))
	r.Register(github.NewGithubAction(store))

	return r
}

// Register adds a dispatcher to the registry.
func (r *Registry) Register(dispatcher types.Dispatchable) {
	r.dispatchers[dispatcher.Type()] = dispatcher
}

// RestoreJobs resumes tracking for all in-processing jobs after an engine restart.
// Dispatchers that implement Restorable get their jobs back; remaining orphaned
// jobs are failed.
func (r *Registry) RestoreJobs(ctx context.Context) {
	allJobs := r.store.Jobs.Items()

	// Collect in-processing jobs grouped by job agent type
	jobsByType := make(map[string][]*oapi.Job)
	for _, job := range allJobs {
		if !job.IsInProcessingState() {
			continue
		}
		agent, ok := r.store.JobAgents.Get(job.JobAgentId)
		if !ok {
			continue
		}
		jobsByType[agent.Type] = append(jobsByType[agent.Type], job)
	}

	if len(jobsByType) == 0 {
		return
	}

	now := time.Now().UTC()
	for agentType, jobs := range jobsByType {
		dispatcher, ok := r.dispatchers[agentType]
		if !ok {
			continue
		}

		restorable, ok := dispatcher.(types.Restorable)
		if ok {
			log.Info("Restoring jobs for dispatcher", "type", agentType, "count", len(jobs))
			if err := restorable.RestoreJobs(ctx, jobs); err != nil {
				log.Error("Failed to restore jobs", "type", agentType, "error", err)
			}
			continue
		}

		// Non-restorable dispatcher: fail orphaned jobs
		for _, job := range jobs {
			message := "Job was in-progress when the engine restarted; dispatch goroutine lost"
			job.Status = oapi.JobStatusFailure
			job.Message = &message
			job.CompletedAt = &now
			job.UpdatedAt = now
			r.store.Jobs.Upsert(ctx, job)
			log.Info("Marked orphaned job as failed", "jobId", job.Id, "agentType", agentType)
		}
	}
}

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job) error {
	jobAgent, ok := r.store.JobAgents.Get(job.JobAgentId)
	if !ok {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	dispatcher, ok := r.dispatchers[jobAgent.Type]
	if !ok {
		return fmt.Errorf("job agent type %s not found", jobAgent.Type)
	}

	return dispatcher.Dispatch(ctx, job)
}
