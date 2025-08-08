package workspace

import (
	"context"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

type SelectorManager struct {
	EnvironmentResources     selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources      selector.SelectorEngine[resource.Resource, deployment.Deployment]
	PolicyTargetResources    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
	PolicyTargetEnvironments selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	PolicyTargetDeployments  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
}

func NewSelectorManager() *SelectorManager {
	return &SelectorManager{
		EnvironmentResources: exhaustive.NewExhaustive[resource.Resource, environment.Environment](),
		DeploymentResources:  exhaustive.NewExhaustive[resource.Resource, deployment.Deployment](),

		PolicyTargetResources:    exhaustive.NewExhaustive[resource.Resource, policy.PolicyTarget](),
		PolicyTargetEnvironments: exhaustive.NewExhaustive[environment.Environment, policy.PolicyTarget](),
		PolicyTargetDeployments:  exhaustive.NewExhaustive[deployment.Deployment, policy.PolicyTarget](),
	}
}

type ResourceSelectorChanges struct {
	Deployments   selector.Change[deployment.Deployment]
	Environments  selector.Change[environment.Environment]
	PolicyTargets selector.Change[policy.PolicyTarget]
}

func (sm *SelectorManager) UpsertResources(ctx context.Context, resources []resource.Resource) (*ResourceSelectorChanges, error) {
	log.Debug("Updating resources", "count", len(resources))

	deploymentChannels := sm.DeploymentResources.UpsertEntity(ctx, resources...)
	environmentChannels := sm.EnvironmentResources.UpsertEntity(ctx, resources...)
	policyChannels := sm.PolicyTargetResources.UpsertEntity(ctx, resources...)

	return &ResourceSelectorChanges{
		Deployments:   selector.NewSelectorChange(deploymentChannels),
		Environments:  selector.NewSelectorChange(environmentChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

func (sm *SelectorManager) RemoveResources(ctx context.Context, resources []resource.Resource) (*ResourceSelectorChanges, error) {
	log.Debug("Removing resources", "count", len(resources))

	deploymentChannels := sm.DeploymentResources.RemoveEntity(ctx, resources...)
	environmentChannels := sm.EnvironmentResources.RemoveEntity(ctx, resources...)
	policyChannels := sm.PolicyTargetResources.RemoveEntity(ctx, resources...)

	return &ResourceSelectorChanges{
		Deployments:   selector.NewSelectorChange(deploymentChannels),
		Environments:  selector.NewSelectorChange(environmentChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

type EnvironmentSelectorChanges struct {
	Resources     selector.Change[resource.Resource]
	PolicyTargets selector.Change[policy.PolicyTarget]
}

func (sm *SelectorManager) UpsertEnvironments(ctx context.Context, environments []environment.Environment) (*EnvironmentSelectorChanges, error) {
	log.Debug("Updating environments", "count", len(environments))

	policyChannels := sm.PolicyTargetEnvironments.UpsertEntity(ctx, environments...)
	resourceChannels := sm.EnvironmentResources.UpsertSelector(ctx, environments...)

	return &EnvironmentSelectorChanges{
		Resources:     selector.NewEntityChange(resourceChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

func (sm *SelectorManager) RemoveEnvironments(ctx context.Context, environments []environment.Environment) (*EnvironmentSelectorChanges, error) {
	log.Debug("Removing environments", "count", len(environments))

	policyChannels := sm.PolicyTargetEnvironments.RemoveEntity(ctx, environments...)
	resourceChannels := sm.EnvironmentResources.RemoveSelector(ctx, environments...)

	return &EnvironmentSelectorChanges{
		Resources:     selector.NewEntityChange(resourceChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

type DeploymentSelectorChanges struct {
	Resources     selector.Change[resource.Resource]
	PolicyTargets selector.Change[policy.PolicyTarget]
}

func (sm *SelectorManager) UpsertDeployments(ctx context.Context, deployments []deployment.Deployment) (*DeploymentSelectorChanges, error) {
	log.Debug("Updating deployments", "count", len(deployments))

	policyChannels := sm.PolicyTargetDeployments.UpsertEntity(ctx, deployments...)
	resourceChannels := sm.DeploymentResources.UpsertSelector(ctx, deployments...)

	return &DeploymentSelectorChanges{
		Resources:     selector.NewEntityChange(resourceChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

func (sm *SelectorManager) RemoveDeployments(ctx context.Context, deployments []deployment.Deployment) (*DeploymentSelectorChanges, error) {
	log.Debug("Removing deployments", "count", len(deployments))

	policyChannels := sm.PolicyTargetDeployments.RemoveEntity(ctx, deployments...)
	resourceChannels := sm.DeploymentResources.RemoveSelector(ctx, deployments...)

	return &DeploymentSelectorChanges{
		Resources:     selector.NewEntityChange(resourceChannels),
		PolicyTargets: selector.NewSelectorChange(policyChannels),
	}, nil
}

type PolicyTargetSelectorChanges struct {
	Resources    selector.Change[resource.Resource]
	Environments selector.Change[environment.Environment]
	Deployments  selector.Change[deployment.Deployment]
}

func (sm *SelectorManager) UpsertPolicyTargets(ctx context.Context, policyTargets []policy.PolicyTarget) (*PolicyTargetSelectorChanges, error) {
	log.Debug("Updating policy targets", "count", len(policyTargets))

	resourceChannels := sm.PolicyTargetResources.UpsertSelector(ctx, policyTargets...)
	environmentChannels := sm.PolicyTargetEnvironments.UpsertSelector(ctx, policyTargets...)
	deploymentChannels := sm.PolicyTargetDeployments.UpsertSelector(ctx, policyTargets...)

	return &PolicyTargetSelectorChanges{
		Resources:    selector.NewEntityChange(resourceChannels),
		Environments: selector.NewEntityChange(environmentChannels),
		Deployments:  selector.NewEntityChange(deploymentChannels),
	}, nil
}

func (sm *SelectorManager) RemovePolicyTargets(ctx context.Context, policyTargets []policy.PolicyTarget) (*PolicyTargetSelectorChanges, error) {
	log.Debug("Removing policy targets", "count", len(policyTargets))

	resourceChannels := sm.PolicyTargetResources.RemoveSelector(ctx, policyTargets...)
	environmentChannels := sm.PolicyTargetEnvironments.RemoveSelector(ctx, policyTargets...)
	deploymentChannels := sm.PolicyTargetDeployments.RemoveSelector(ctx, policyTargets...)

	return &PolicyTargetSelectorChanges{
		Resources:    selector.NewEntityChange(resourceChannels),
		Environments: selector.NewEntityChange(environmentChannels),
		Deployments:  selector.NewEntityChange(deploymentChannels),
	}, nil
}
