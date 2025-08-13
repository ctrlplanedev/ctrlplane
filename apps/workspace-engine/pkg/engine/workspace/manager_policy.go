package workspace

import (
	"context"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"
)

type PolicyManager struct {
	repository      *WorkspaceRepository
	selectorManager *SelectorManager
}

func NewPolicyManager(repo *WorkspaceRepository) *PolicyManager {
	return &PolicyManager{
		repository: repo,
	}
}

func (m *PolicyManager) GetReleaseTargetPolicies(ctx context.Context, releaseTarget *rt.ReleaseTarget) ([]*policy.Policy, error) {
	allPolicies := m.repository.Policy.GetAll(ctx)

	policies := make([]*policy.Policy, 0)
	for _, policy := range allPolicies {
		for _, policyTarget := range policy.PolicyTargets {
			policyMatches, err := m.PolicyTargetMatchesReleaseTarget(ctx, &policyTarget, releaseTarget)
			if err != nil {
				return nil, err
			}
			// if any match, add the policy to the list and go to the next policy
			if policyMatches {
				policies = append(policies, policy)
				break
			}
		}
	}

	return policies, nil
}

func (m *PolicyManager) PolicyTargetMatchesReleaseTarget(ctx context.Context, policyTarget *policy.PolicyTarget, releaseTarget *rt.ReleaseTarget) (bool, error) {
	resourceMatches, err := m.matchesResourceSelector(ctx, policyTarget, releaseTarget.Resource)
	if err != nil {
		return false, err
	}

	envMatches, err := m.matchesEnvironmentSelector(ctx, policyTarget, releaseTarget.Environment)
	if err != nil {
		return false, err
	}

	deploymentMatches, err := m.matchesDeploymentSelector(ctx, policyTarget, releaseTarget.Deployment)
	if err != nil {
		return false, err
	}

	return resourceMatches && envMatches && deploymentMatches, nil
}

// matchesResourceSelector checks if this ReleaseTarget's resource matches the selector
func (m *PolicyManager) matchesResourceSelector(
	ctx context.Context,
	policyTarget *policy.PolicyTarget,
	resource resource.Resource,
) (bool, error) {
	if policyTarget.ResourceSelector == nil {
		return true, nil
	}

	resources, err := m.selectorManager.PolicyTargetResources.GetEntitiesForSelector(ctx, *policyTarget)
	if err != nil {
		return false, err
	}

	for _, r := range resources {
		if r.GetID() == resource.GetID() {
			return true, nil
		}
	}

	return false, nil
}

// matchesEnvironmentSelector checks if this ReleaseTarget's environment matches the selector
func (m *PolicyManager) matchesEnvironmentSelector(
	ctx context.Context,
	policyTarget *policy.PolicyTarget,
	environment environment.Environment,
) (bool, error) {
	if policyTarget.EnvironmentSelector == nil {
		return true, nil
	}

	environments, err := m.selectorManager.PolicyTargetEnvironments.GetEntitiesForSelector(ctx, *policyTarget)
	if err != nil {
		return false, err
	}

	for _, e := range environments {
		if environment.GetID() == e.GetID() {
			return true, nil
		}
	}

	return false, nil
}

func (m *PolicyManager) matchesDeploymentSelector(
	ctx context.Context,
	policyTarget *policy.PolicyTarget,
	deployment deployment.Deployment,
) (bool, error) {
	if policyTarget.DeploymentSelector == nil {
		return true, nil
	}

	deployments, err := m.selectorManager.PolicyTargetDeployments.GetEntitiesForSelector(ctx, *policyTarget)
	if err != nil {
		return false, err
	}

	for _, d := range deployments {
		if deployment.GetID() == d.GetID() {
			return true, nil
		}
	}

	return false, nil
}

type PolicyEvaluationResult struct {
	PolicyID string
	Rules    []rules.RuleEvaluationResult

	// Version that can be deployed to the release target
	Version deployment.DeploymentVersion
}

func (r *PolicyEvaluationResult) Passed() bool {
	for _, rule := range r.Rules {
		if !rule.Passed() {
			return false
		}
	}
	return true
}

func (m *PolicyManager) EvaluatePolicy(
	ctx context.Context,
	policy *policy.Policy,
	releaseTarget *rt.ReleaseTarget,
) ([]PolicyEvaluationResult, error) {
	rulePtrs := m.repository.Rule.GetAllForPolicy(ctx, policy.GetID())
	limit := 500
	allVersions := m.repository.DeploymentVersion.GetAllForDeployment(ctx, releaseTarget.Deployment.GetID(), &limit)

	results := make([]PolicyEvaluationResult, 0, len(allVersions))

	for _, version := range allVersions {
		result := PolicyEvaluationResult{
			PolicyID: policy.GetID(),
			Version:  version,
			Rules:    make([]rules.RuleEvaluationResult, 0, len(rulePtrs)),
		}

		for _, rulePtr := range rulePtrs {
			rule := *rulePtr
			evaluation, err := rule.Evaluate(ctx, *releaseTarget, version)
			if err != nil {
				return nil, err
			}
			result.Rules = append(result.Rules, *evaluation)
		}

		results = append(results, result)
	}

	return results, nil
}
