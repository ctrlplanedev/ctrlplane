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
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"
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

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job) error {
	jobAgent, ok := r.store.JobAgents.Get(job.JobAgentId)
	if !ok {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	dispatcher, ok := r.dispatchers[jobAgent.Type]
	if !ok {
		return fmt.Errorf("job agent type %s not found", jobAgent.Type)
	}

	renderContext := types.DispatchContext{}
	renderContext.Job = job
	renderContext.JobAgent = jobAgent

	isWorkflow := job.WorkflowJobId != ""
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
		jobAgentConfig, err := mergeJobAgentConfig(
			jobAgent.Config,
			jobWithRelease.Deployment.JobAgentConfig,
			jobWithRelease.Release.Version.JobAgentConfig,
		)
		if err != nil {
			return fmt.Errorf("failed to merge job agent config: %w", err)
		}
		renderContext.JobAgentConfig = jobAgentConfig
	}

	if workflowJob, ok := r.store.WorkflowJobs.Get(job.WorkflowJobId); ok {
		renderContext.WorkflowJob = workflowJob
		if workflow, ok := r.store.Workflows.Get(workflowJob.WorkflowId); ok {
			renderContext.Workflow = workflow
		}
		if job.JobAgentConfig["matrix"] != nil {
			renderContext.Matrix = job.JobAgentConfig["matrix"].(map[string]interface{})
		}
	}

	return dispatcher.Dispatch(ctx, renderContext)
}

// mergeJobAgentConfig merges the given job agent configs into a single config.
// The configs are merged in the order they are provided, with later configs overriding earlier ones.
func mergeJobAgentConfig(configs ...oapi.JobAgentConfig) (oapi.JobAgentConfig, error) {
	mergedConfig := make(map[string]any)
	for _, config := range configs {
		deepMerge(mergedConfig, config)
	}
	return mergedConfig, nil
}

func deepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				deepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v
	}
}
