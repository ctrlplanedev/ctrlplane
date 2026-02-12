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

func (r *Registry) fillReleaseContext(job *oapi.Job, ctx *types.DispatchContext) error {
	releaseId := job.ReleaseId
	if releaseId == "" {
		return nil
	}

	jobWithRelease, err := r.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		return fmt.Errorf("failed to get job with release: %w", err)
	}

	ctx.Release = &jobWithRelease.Release
	ctx.Deployment = jobWithRelease.Deployment
	ctx.Environment = jobWithRelease.Environment
	ctx.Resource = jobWithRelease.Resource
	ctx.Version = &jobWithRelease.Release.Version

	return nil
}

func (r *Registry) fillWorkflowContext(job *oapi.Job, ctx *types.DispatchContext) error {
	if job.WorkflowJobId == "" {
		return nil
	}

	workflowJob, ok := r.store.WorkflowJobs.Get(job.WorkflowJobId)
	if !ok {
		return fmt.Errorf("workflow job not found: %s", job.WorkflowJobId)
	}

	workflowRun, ok := r.store.WorkflowRuns.Get(workflowJob.WorkflowRunId)
	if !ok {
		return fmt.Errorf("workflow run not found: %s", workflowJob.WorkflowRunId)
	}

	ctx.WorkflowJob = workflowJob
	ctx.WorkflowRun = workflowRun
	return nil
}

func (r *Registry) getMergedJobAgentConfig(jobAgent *oapi.JobAgent, ctx *types.DispatchContext) (oapi.JobAgentConfig, error) {
	agentConfig := jobAgent.Config

	var workflowJobConfig oapi.JobAgentConfig
	if ctx.WorkflowJob != nil {
		workflowJobConfig = ctx.WorkflowJob.Config
	}

	var deploymentConfig oapi.JobAgentConfig
	if ctx.Deployment != nil {
		deploymentConfig = ctx.Deployment.JobAgentConfig
	}

	var versionConfig oapi.JobAgentConfig
	if ctx.Version != nil {
		versionConfig = ctx.Version.JobAgentConfig
	}

	mergedConfig, err := mergeJobAgentConfig(agentConfig, deploymentConfig, workflowJobConfig, versionConfig)
	if err != nil {
		return oapi.JobAgentConfig{}, fmt.Errorf("failed to merge job agent configs: %w", err)
	}

	return mergedConfig, nil
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

	dispatchContext := types.DispatchContext{}
	dispatchContext.Job = job
	dispatchContext.JobAgent = jobAgent

	if err := r.fillReleaseContext(job, &dispatchContext); err != nil {
		return fmt.Errorf("failed to get release context: %w", err)
	}
	if err := r.fillWorkflowContext(job, &dispatchContext); err != nil {
		return fmt.Errorf("failed to get workflow context: %w", err)
	}
	mergedConfig, err := r.getMergedJobAgentConfig(jobAgent, &dispatchContext)
	if err != nil {
		return fmt.Errorf("failed to merge all job agent configs: %w", err)
	}
	dispatchContext.JobAgentConfig = mergedConfig

	job.JobAgentConfig = mergedConfig
	r.store.Jobs.Upsert(ctx, job)
	return dispatcher.Dispatch(ctx, dispatchContext)
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
