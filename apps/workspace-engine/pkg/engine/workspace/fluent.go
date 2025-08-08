package workspace

import (
	"context"

	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

type Operation string

const (
	OperationUpdate Operation = "update"
	OperationRemove Operation = "remove"
)

// FluentPipeline represents the fluent API pipeline
type FluentPipeline struct {
	engine    *WorkspaceEngine
	ctx       context.Context
	operation Operation
	err       error

	// Pipeline state
	resources    []resource.Resource
	environments []environment.Environment
	deployments  []deployment.Deployment
	policyIDs    []string

	// results
	releaseTargetPolicies map[string][]*policy.Policy
	selectorChanges       *ResourceSelectorChanges
	environmentChanges    *EnvironmentSelectorChanges
	deploymentChanges     *DeploymentSelectorChanges
	policyChanges         *PolicyTargetSelectorChanges

	releaseTargets *ReleaseTargetChanges
	// policyMatches    []epolicy.PolicyMatch
	dispatchRequests []JobDispatchRequest
}

func (fp *FluentPipeline) GetReleaseTargetChanges() *FluentPipeline {
	if fp.err != nil {
		return fp
	}
	changes, err := fp.engine.ReleaseTargetManager.ComputeReleaseTargetChanges(fp.ctx)
	if err != nil {
		fp.err = err
		return fp
	}

	err = fp.engine.ReleaseTargetManager.PersistChanges(fp.ctx, changes)
	if err != nil {
		fp.err = err
		return fp
	}

	fp.releaseTargets = changes
	return fp
}

func (fp *FluentPipeline) UpdateSelectors() *FluentPipeline {
	if fp.err != nil {
		return fp
	}

	switch fp.operation {
	case OperationUpdate:
		if len(fp.resources) > 0 {
			changes, err := fp.engine.SelectorManager.UpsertResources(fp.ctx, fp.resources)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.selectorChanges = changes
		}
		if len(fp.environments) > 0 {
			changes, err := fp.engine.SelectorManager.UpsertEnvironments(fp.ctx, fp.environments)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.environmentChanges = changes
		}
		if len(fp.deployments) > 0 {
			changes, err := fp.engine.SelectorManager.UpsertDeployments(fp.ctx, fp.deployments)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.deploymentChanges = changes
		}
		if len(fp.policyIDs) > 0 {
			// TODO: fix typing error from fp.policyIDs
			changes, err := fp.engine.SelectorManager.UpsertPolicyTargets(fp.ctx, []policy.PolicyTarget{} /*fp.policyIDs*/)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.policyChanges = changes
		}
	case OperationRemove:
		if len(fp.resources) > 0 {
			changes, err := fp.engine.SelectorManager.RemoveResources(fp.ctx, fp.resources)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.selectorChanges = changes
		}
		if len(fp.environments) > 0 {
			changes, err := fp.engine.SelectorManager.RemoveEnvironments(fp.ctx, fp.environments)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.environmentChanges = changes
		}
		if len(fp.deployments) > 0 {
			changes, err := fp.engine.SelectorManager.RemoveDeployments(fp.ctx, fp.deployments)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.deploymentChanges = changes
		}
		if len(fp.policyIDs) > 0 {
			// TODO: fix typing error from fp.policyIDs
			changes, err := fp.engine.SelectorManager.RemovePolicyTargets(fp.ctx, []policy.PolicyTarget{} /*fp.policyIDs*/)
			if err != nil {
				fp.err = err
				return fp
			}
			fp.policyChanges = changes
		}
	}
	return fp
}

func (fp *FluentPipeline) GetMatchingPolicies() *FluentPipeline {
	if fp.err != nil {
		return fp
	}

	for _, releaseTarget := range fp.releaseTargets.Added {
		policies, err := fp.engine.PolicyManager.GetReleaseTargetPolicies(fp.ctx, releaseTarget)
		if err != nil {
			fp.err = err
			return fp
		}
		fp.releaseTargetPolicies[releaseTarget.GetID()] = policies
	}

	return fp
}

func (fp *FluentPipeline) EvaulatePolicies() *FluentPipeline {
	if fp.err != nil {
		return fp
	}
	if fp.releaseTargets == nil || len(fp.releaseTargets.Added) == 0 {
		log.Warn("No release targets found, skipping policy evaluation")
		return fp
	}

	if len(fp.releaseTargetPolicies) == 0 {
		log.Warn("No release target policies found, skipping policy evaluation")
		return fp
	}

	for _, releaseTarget := range fp.releaseTargets.Added {
		policies := fp.releaseTargetPolicies[releaseTarget.GetID()]
		// TODO: version stuff
		for _, policy := range policies {
			result, err := fp.engine.PolicyManager.EvaluatePolicy(fp.ctx, policy, releaseTarget)
			if err != nil {
				fp.err = err
				return fp
			}

			if !result.Passed() {
				log.Warn("Policy evaluation failed, skipping policy dispatch", "policy", policy.GetID(), "releaseTarget", releaseTarget.GetID())
				continue
			}

			if len(result.Versions) == 0 {
				log.Warn("All policies passed but no version was found. This should never happen.", "policy", policy.GetID(), "releaseTarget", releaseTarget.GetID())
				continue
			}

			request := JobDispatchRequest{
				ReleaseTarget: releaseTarget,
				Versions:      &result.Versions[0],
			}
			fp.dispatchRequests = append(fp.dispatchRequests, request)
		}
	}
	return fp
}

func (fp *FluentPipeline) Dispatch() error {
	return fp.err
}

func (fp *FluentPipeline) CreateHookDispatchRequests() *FluentPipeline {
	return fp
}

func (fp *FluentPipeline) CreateDeploymentDispatchRequests() *FluentPipeline {
	return fp
}
