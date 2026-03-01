package jobagents

import (
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents/configs"
)

type DeploymentAgentsSelector struct {
	deployment *oapi.Deployment
	release    *oapi.Release
	getter     Getter
}

func NewDeploymentAgentsSelector(getter Getter, deployment *oapi.Deployment, release *oapi.Release) *DeploymentAgentsSelector {
	return &DeploymentAgentsSelector{
		deployment: deployment,
		release:    release,
		getter:     getter,
	}
}

func (s *DeploymentAgentsSelector) getLegacyJobAgent() ([]*oapi.JobAgent, error) {
	jobAgent, exists := s.getter.GetJobAgent(*s.deployment.JobAgentId)
	if !exists {
		return nil, fmt.Errorf("job agent %s not found", *s.deployment.JobAgentId)
	}

	resolvedAgent, err := s.withResolvedConfig(jobAgent, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve config for job agent %s: %w", jobAgent.Id, err)
	}

	return []*oapi.JobAgent{resolvedAgent}, nil
}

func (s *DeploymentAgentsSelector) withResolvedConfig(jobAgent *oapi.JobAgent, deploymentJobAgentConfig oapi.JobAgentConfig) (*oapi.JobAgent, error) {
	mergedConfig, err := configs.Merge(
		jobAgent.Config,
		s.deployment.JobAgentConfig,
		deploymentJobAgentConfig,
		s.release.Version.JobAgentConfig,
	)
	if err != nil {
		return nil, err
	}

	jobAgentWithConfig := *jobAgent
	jobAgentWithConfig.Config = mergedConfig
	return &jobAgentWithConfig, nil
}

func (s *DeploymentAgentsSelector) buildCelContext() (map[string]any, error) {
	environment, exists := s.getter.GetEnvironment(s.release.ReleaseTarget.EnvironmentId)
	if !exists {
		return nil, fmt.Errorf("environment %s not found", s.release.ReleaseTarget.EnvironmentId)
	}
	resource, exists := s.getter.GetResource(s.release.ReleaseTarget.ResourceId)
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
		jobAgent, agentExists := s.getter.GetJobAgent(deploymentJobAgent.Ref)
		if !agentExists {
			return nil, fmt.Errorf("job agent %s not found", deploymentJobAgent.Ref)
		}
		resolvedAgent, err := s.withResolvedConfig(jobAgent, deploymentJobAgent.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve config for job agent %s: %w", deploymentJobAgent.Ref, err)
		}
		jobAgents = append(jobAgents, resolvedAgent)
	}
	return jobAgents, nil
}
