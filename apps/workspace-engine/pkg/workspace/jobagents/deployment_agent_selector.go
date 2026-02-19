package jobagents

import (
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type DeploymentAgentsSelector struct {
	store      *store.Store
	deployment *oapi.Deployment
	release    *oapi.Release
}

func NewDeploymentAgentsSelector(store *store.Store, deployment *oapi.Deployment, release *oapi.Release) *DeploymentAgentsSelector {
	return &DeploymentAgentsSelector{
		store:      store,
		deployment: deployment,
		release:    release,
	}
}

func (s *DeploymentAgentsSelector) getLegacyJobAgent() ([]*oapi.JobAgent, error) {
	jobAgent, exists := s.store.JobAgents.Get(*s.deployment.JobAgentId)
	if !exists {
		return nil, fmt.Errorf("job agent %s not found", *s.deployment.JobAgentId)
	}
	return []*oapi.JobAgent{jobAgent}, nil
}

func (s *DeploymentAgentsSelector) buildCelContext() (map[string]any, error) {
	environment, exists := s.store.Environments.Get(s.release.ReleaseTarget.EnvironmentId)
	if !exists {
		return nil, fmt.Errorf("environment %s not found", s.release.ReleaseTarget.EnvironmentId)
	}
	resource, exists := s.store.Resources.Get(s.release.ReleaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %s not found", s.release.ReleaseTarget.ResourceId)
	}
	releaseMap, err := celutil.EntityToMap(s.release)
	if err != nil {
		return nil, fmt.Errorf("failed to convert release to map: %w", err)
	}
	deploymentMap, err := celutil.EntityToMap(s.deployment)
	if err != nil {
		return nil, fmt.Errorf("failed to convert deployment to map: %w", err)
	}
	environmentMap, err := celutil.EntityToMap(environment)
	if err != nil {
		return nil, fmt.Errorf("failed to convert environment to map: %w", err)
	}
	resourceMap, err := celutil.EntityToMap(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to convert resource to map: %w", err)
	}
	return map[string]any{
		"release":     releaseMap,
		"deployment":  deploymentMap,
		"environment": environmentMap,
		"resource":    resourceMap,
	}, nil
}

func (s *DeploymentAgentsSelector) SelectAgents() ([]*oapi.JobAgent, error) {
	if s.deployment.JobAgents != nil && len(*s.deployment.JobAgents) > 0 {
		return s.selectFromJobAgents()
	}

	if s.deployment.JobAgentId != nil && *s.deployment.JobAgentId != "" {
		return s.getLegacyJobAgent()
	}

	return []*oapi.JobAgent{}, nil
}

func (s *DeploymentAgentsSelector) selectFromJobAgents() ([]*oapi.JobAgent, error) {
	celCtx, err := s.buildCelContext()
	if err != nil {
		return nil, fmt.Errorf("failed to build cel context: %w", err)
	}

	jobAgentIfEnv, err := celutil.NewEnvBuilder().
		WithMapVariables("release", "deployment", "environment", "resource").
		WithStandardExtensions().
		BuildCached(12 * time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to build job agent if cel environment: %w", err)
	}

	jobAgents := make([]*oapi.JobAgent, 0)
	for _, deploymentJobAgent := range *s.deployment.JobAgents {
		if deploymentJobAgent.Selector != "" {
			program, err := jobAgentIfEnv.Compile(deploymentJobAgent.Selector)
			if err != nil {
				return nil, fmt.Errorf("failed to compile job agent if expression %q: %w", deploymentJobAgent.Selector, err)
			}
			result, err := celutil.EvalBool(program, celCtx)
			if err != nil {
				return nil, fmt.Errorf("failed to evaluate job agent if expression: %w", err)
			}
			if !result {
				continue
			}
		}
		jobAgent, agentExists := s.store.JobAgents.Get(deploymentJobAgent.Ref)
		if !agentExists {
			return nil, fmt.Errorf("job agent %s not found", deploymentJobAgent.Ref)
		}
		jobAgents = append(jobAgents, jobAgent)
	}
	return jobAgents, nil
}
