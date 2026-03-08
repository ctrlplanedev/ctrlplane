package jobagents

import (
	"context"
	"fmt"
	"strings"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/workspace/jobagents/argo"
	"workspace-engine/pkg/workspace/jobagents/github"
	"workspace-engine/pkg/workspace/jobagents/terraformcloud"
	"workspace-engine/pkg/workspace/jobagents/testrunner"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type Registry struct {
	dispatchers map[string]types.Dispatchable
	store       *store.Store
	queue       reconcile.Queue
}

func NewRegistry(store *store.Store, verifications *verification.Manager, queue reconcile.Queue) *Registry {
	r := &Registry{}
	r.dispatchers = make(map[string]types.Dispatchable)
	r.store = store
	r.queue = queue

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

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job) error {
	if r.shouldEnqueue() {
		return r.enqueueJobDispatch(ctx, job)
	}

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

func (r *Registry) shouldEnqueue() bool {
	if r.queue == nil {
		return false
	}
	svcList := strings.TrimSpace(config.Global.Services)
	if svcList == "" {
		return true
	}
	for name := range strings.SplitSeq(svcList, ",") {
		if strings.TrimSpace(name) == events.JobDispatchKind {
			return true
		}
	}
	return false
}

func (r *Registry) enqueueJobDispatch(ctx context.Context, job *oapi.Job) error {
	jobID, err := uuid.Parse(job.Id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}
	releaseID, err := uuid.Parse(job.ReleaseId)
	if err != nil {
		return fmt.Errorf("parse release id: %w", err)
	}

	if err := db.GetQueries(ctx).InsertReleaseJob(ctx, db.InsertReleaseJobParams{
		ReleaseID: releaseID,
		JobID:     jobID,
	}); err != nil {
		return fmt.Errorf("insert release job: %w", err)
	}

	return events.EnqueueJobDispatch(r.queue, ctx, events.JobDispatchParams{
		WorkspaceID: r.store.ID(),
		JobID:       job.Id,
	})
}
