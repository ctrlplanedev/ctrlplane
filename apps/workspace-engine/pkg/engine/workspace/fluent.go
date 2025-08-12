package workspace

import (
	"context"

	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

type Operation string

const (
	OperationCreate Operation = "create"
	OperationUpdate Operation = "update"
	OperationRemove Operation = "remove"
)

type ReleaseTargetResult struct {
	Removed    []*rt.ReleaseTarget
	ToEvaluate []*rt.ReleaseTarget
}

// FluentPipeline represents the fluent API pipeline
type FluentPipeline struct {
	engine    *WorkspaceEngine
	ctx       context.Context
	operation Operation
	err       error

	// Pipeline state
	resources          []resource.Resource
	environments       []environment.Environment
	deployments        []deployment.Deployment
	policyIDs          []string
	deploymentVersions []deployment.DeploymentVersion

	// results
	releaseTargetPolicies map[string][]*policy.Policy
	selectorChanges       *ResourceSelectorChanges
	environmentChanges    *EnvironmentSelectorChanges
	deploymentChanges     *DeploymentSelectorChanges
	policyChanges         *PolicyTargetSelectorChanges

	releaseTargets *ReleaseTargetResult
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

	fp.releaseTargets = &ReleaseTargetResult{
		Removed:    changes.Removed,
		ToEvaluate: changes.Added,
	}
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

func (fp *FluentPipeline) UpdateDeploymentVersions() *FluentPipeline {
	if fp.err != nil {
		return fp
	}

	if len(fp.deploymentVersions) == 0 {
		return fp
	}

	switch fp.operation {
	case OperationCreate:
		for _, deploymentVersion := range fp.deploymentVersions {
			if err := fp.engine.Repository.DeploymentVersion.Create(fp.ctx, deploymentVersion); err != nil {
				fp.err = err
				return fp
			}
		}
	case OperationUpdate:
		for _, deploymentVersion := range fp.deploymentVersions {
			if err := fp.engine.Repository.DeploymentVersion.Update(fp.ctx, deploymentVersion); err != nil {
				fp.err = err
				return fp
			}
		}
	case OperationRemove:
		for _, deploymentVersion := range fp.deploymentVersions {
			if err := fp.engine.Repository.DeploymentVersion.Delete(fp.ctx, deploymentVersion.ID); err != nil {
				fp.err = err
				return fp
			}
		}
	}

	uniqueDeploymentIds := make(map[string]bool)
	for _, deploymentVersion := range fp.deploymentVersions {
		uniqueDeploymentIds[deploymentVersion.DeploymentID] = true
	}

	releaseTargetsToEvaluate := make([]*rt.ReleaseTarget, 0)
	for deploymentID := range uniqueDeploymentIds {
		releaseTargetsToEvaluate = append(releaseTargetsToEvaluate, fp.engine.Repository.ReleaseTarget.GetAllForDeployment(fp.ctx, deploymentID)...)
	}

	fp.releaseTargets = &ReleaseTargetResult{
		ToEvaluate: releaseTargetsToEvaluate,
	}
	return fp
}

func (fp *FluentPipeline) GetMatchingPolicies() *FluentPipeline {
	if fp.err != nil {
		return fp
	}

	for _, releaseTarget := range fp.releaseTargets.ToEvaluate {
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
	if fp.releaseTargets == nil || len(fp.releaseTargets.ToEvaluate) == 0 {
		log.Warn("No release targets found, skipping policy evaluation")
		return fp
	}

	if len(fp.releaseTargetPolicies) == 0 {
		log.Warn("No release target policies found, skipping policy evaluation")
		return fp
	}

	for _, releaseTarget := range fp.releaseTargets.ToEvaluate {
		policies := fp.releaseTargetPolicies[releaseTarget.GetID()]
		deploymentID := releaseTarget.Deployment.GetID()
		deploymentVersions := fp.engine.Repository.DeploymentVersion.GetAllForDeployment(fp.ctx, deploymentID)
		// TODO: version stuff
		for _, policy := range policies {
			result, err := fp.engine.PolicyManager.EvaluatePolicy(fp.ctx, policy, releaseTarget)
			if err != nil {
				fp.err = err
				return fp
			}

			if result == nil {
				log.Warn("Policy evaluation returned nil, skipping job dispatch", "policy", policy.GetID(), "releaseTarget", releaseTarget.GetID())
				continue
			}

			if !result.Passed() {
				log.Warn("Policy evaluation failed, skipping job dispatch", "policy", policy.GetID(), "releaseTarget", releaseTarget.GetID())
				continue
			}

			if len(result.Versions) == 0 {
				log.Warn("All policies passed but no version was found. This should never happen.", "policy", policy.GetID(), "releaseTarget", releaseTarget.GetID())
				continue
			}

			newDeploymentVersions := make([]deployment.DeploymentVersion, 0)
			for _, version := range deploymentVersions {
				for _, filteredVersion := range result.Versions {
					if filteredVersion.ID == version.ID {
						newDeploymentVersions = append(newDeploymentVersions, version)
					}
				}
			}
			deploymentVersions = newDeploymentVersions
		}

		if len(deploymentVersions) == 0 {
			log.Warn("No deployment versions found, skipping job dispatch", "releaseTarget", releaseTarget.GetID())
			continue
		}

		request := JobDispatchRequest{
			ReleaseTarget: releaseTarget,
			Versions:      &deploymentVersions[0],
		}
		fp.dispatchRequests = append(fp.dispatchRequests, request)
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
