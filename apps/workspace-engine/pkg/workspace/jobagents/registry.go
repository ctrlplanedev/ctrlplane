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

func (r *Registry) fillReleaseContext(job *oapi.Job, ctx *oapi.DispatchContext) error {
	releaseId := job.ReleaseId
	if releaseId == "" {
		return nil
	}

	jobWithRelease, err := r.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		return fmt.Errorf("failed to get job with release: %w", err)
	}

	release := jobWithRelease.Release
	ctx.Release = &release
	version := release.Version
	ctx.Version = &version

	if jobWithRelease.Deployment != nil {
		dep := *jobWithRelease.Deployment
		ctx.Deployment = &dep
	}
	if jobWithRelease.Environment != nil {
		env := *jobWithRelease.Environment
		ctx.Environment = &env
	}
	if jobWithRelease.Resource != nil {
		res := *jobWithRelease.Resource
		ctx.Resource = &res
	}
	if jobWithRelease.Release.Variables != nil {
		variables := make(map[string]any)
		for k, v := range jobWithRelease.Release.Variables {
			variables[k] = v.String()
		}
		ctx.Variables = &variables
	}

	return nil
}

func (r *Registry) fillWorkflowContext(job *oapi.Job, ctx *oapi.DispatchContext) error {
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

	workflow, ok := r.store.Workflows.Get(workflowRun.WorkflowId)
	if !ok {
		return fmt.Errorf("workflow not found: %s", workflowRun.WorkflowId)
	}

	wf := *workflow
	ctx.Workflow = &wf
	wj := *workflowJob
	ctx.WorkflowJob = &wj
	wr := *workflowRun
	ctx.WorkflowRun = &wr
	return nil
}

func (r *Registry) fillJobAgentContext(jobAgent *oapi.JobAgent, ctx *oapi.DispatchContext) error {
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
		return fmt.Errorf("failed to merge job agent configs: %w", err)
	}

	ctx.JobAgentConfig = mergedConfig
	agent := *jobAgent
	ctx.JobAgent = agent
	return nil
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

	dispatchContext := oapi.DispatchContext{}
	dispatchContext.JobAgent = *jobAgent

	if err := r.fillReleaseContext(job, &dispatchContext); err != nil {
		return fmt.Errorf("failed to get release context: %w", err)
	}
	if err := r.fillWorkflowContext(job, &dispatchContext); err != nil {
		return fmt.Errorf("failed to get workflow context: %w", err)
	}
	if err := r.fillJobAgentContext(jobAgent, &dispatchContext); err != nil {
		return fmt.Errorf("failed to get job agent context: %w", err)
	}

	job.JobAgentConfig = dispatchContext.JobAgentConfig
	job.DispatchContext = &dispatchContext
	r.store.Jobs.Upsert(ctx, job)
	return dispatcher.Dispatch(ctx, job)
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
