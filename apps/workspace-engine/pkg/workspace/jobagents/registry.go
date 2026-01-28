package jobagents

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents/argo"
	"workspace-engine/pkg/workspace/jobagents/github"
	"workspace-engine/pkg/workspace/jobagents/terraformcloud"
	"workspace-engine/pkg/workspace/jobagents/testrunner"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"
)

type Registry struct {
	dispatchers map[string]types.Dispatchable
	store       *store.Store
}

func NewRegistry(store *store.Store) *Registry {
	r := &Registry{}
	r.dispatchers = make(map[string]types.Dispatchable)
	r.store = store

	r.Register(testrunner.New(store))
	r.Register(argo.NewArgoApplication(store))
	r.Register(terraformcloud.NewTFE(store))
	r.Register(github.NewGithubAction(store))

	return r
}

// Register adds a dispatcher to the registry.
func (r *Registry) Register(dispatcher types.Dispatchable) {
	r.dispatchers[dispatcher.Type()] = dispatcher
}

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job, jobAgentConfig oapi.JobAgentConfig) error {
	jobAgent, ok := r.store.JobAgents.Get(job.JobAgentId)
	if !ok {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	dispatcher, ok := r.dispatchers[jobAgent.Type]
	if !ok {
		return fmt.Errorf("job agent type %s not found", jobAgent.Type)
	}

	renderContext := types.RenderContext{}
	renderContext.Job = job
	renderContext.JobAgent = jobAgent

	isWorkflow := job.WorkflowStepId != ""
	caps := dispatcher.Supports()

	if isWorkflow && !caps.Workflows {
		return fmt.Errorf("job agent type %s does not support workflows", jobAgent.Type)
	}

	if !isWorkflow && !caps.Deployments {
		return fmt.Errorf("job agent type %s does not support deployments", jobAgent.Type)
	}

	if jobWithRelease, _ := r.store.Jobs.GetWithRelease(job.Id); jobWithRelease != nil {
		renderContext.Release = &jobWithRelease.Release
		renderContext.Deployment = jobWithRelease.Deployment
		renderContext.Environment = jobWithRelease.Environment
		renderContext.Resource = jobWithRelease.Resource
	}

	if workflowStep, ok := r.store.WorkflowSteps.Get(job.WorkflowStepId); ok {
		renderContext.WorkflowStep = workflowStep
		if workflow, ok := r.store.Workflows.Get(workflowStep.WorkflowId); ok {
			renderContext.Workflow = workflow
		}
	}

	return dispatcher.Dispatch(ctx, renderContext)
}
