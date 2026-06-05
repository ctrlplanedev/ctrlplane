package workflows

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
)

type plannedDispatch struct {
	runner       db.JobAgent
	mergedConfig oapi.JobAgentConfig
	dispatchCtx  *oapi.DispatchContext
}

func buildDispatchContext(workflow *oapi.Workflow, inputs map[string]any) *oapi.DispatchContext {
	return &oapi.DispatchContext{
		Workflow: workflow,
		Inputs:   &inputs,
	}
}

func planDispatches(
	ctx context.Context,
	base *oapi.DispatchContext,
	resources []*oapi.Resource,
	jobAgents []oapi.WorkflowJobAgent,
	runners map[string]db.JobAgent,
) ([]plannedDispatch, error) {
	planned := make([]plannedDispatch, 0, len(resources)*len(jobAgents))
	for _, resource := range resources {
		resourceCtx := *base
		resourceCtx.Resource = resource

		matchResource := resource
		if matchResource == nil {
			matchResource = &oapi.Resource{}
		}

		for _, jobAgent := range jobAgents {
			runner := runners[jobAgent.Ref]
			mergedConfig := mergeWorkflowJobAgentConfig(runner.Config, jobAgent.Config)
			dispatchCtx := buildJobDispatchContext(&resourceCtx, runner, mergedConfig)
			matchAgent := dispatchCtx.JobAgent
			matchAgent.Config = mergedConfig

			matched, err := selector.MatchJobAgentsWithResource(
				ctx,
				jobAgent.Selector,
				[]oapi.JobAgent{matchAgent},
				matchResource,
			)
			if err != nil {
				return nil, fmt.Errorf("match selector: %w", err)
			}
			if len(matched) == 0 {
				continue
			}

			planned = append(planned, plannedDispatch{
				runner:       runner,
				mergedConfig: mergedConfig,
				dispatchCtx:  dispatchCtx,
			})
		}
	}
	return planned, nil
}

func mergeWorkflowJobAgentConfig(
	runnerConfig, perJobConfig oapi.JobAgentConfig,
) oapi.JobAgentConfig {
	return oapi.DeepMergeConfigs(runnerConfig, perJobConfig)
}

func buildJobDispatchContext(
	base *oapi.DispatchContext,
	runner db.JobAgent,
	mergedConfig oapi.JobAgentConfig,
) *oapi.DispatchContext {
	out := *base
	out.JobAgent = oapi.JobAgent{
		Id:          runner.ID.String(),
		WorkspaceId: runner.WorkspaceID.String(),
		Name:        runner.Name,
		Type:        runner.Type,
		Config:      runner.Config,
	}
	out.JobAgentConfig = mergedConfig
	return &out
}
