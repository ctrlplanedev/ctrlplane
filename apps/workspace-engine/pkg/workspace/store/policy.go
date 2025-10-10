package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/changeset"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo:           store.repo,
		store:          store,
		releaseTargets: cmap.New[*materialized.MaterializedView[map[string]*oapi.ReleaseTarget]](),
	}
}

type Policies struct {
	repo           *repository.Repository
	store          *Store
	releaseTargets cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.ReleaseTarget]]
}

func (p *Policies) Items() map[string]*oapi.Policy {
	return p.repo.Policies.Items()
}

func (p *Policies) recomputeReleaseTargets(policyId string) materialized.RecomputeFunc[map[string]*oapi.ReleaseTarget] {
	return func(ctx context.Context) (map[string]*oapi.ReleaseTarget, error) {
		policy, ok := p.Get(policyId)
		if !ok {
			return nil, fmt.Errorf("policy %s not found", policyId)
		}

		releaseTargets := make(map[string]*oapi.ReleaseTarget)

		for _, policyTarget := range policy.Selectors {
			// Build sets of matching deployments and environments
			matchingDeployments := make(map[string]*oapi.Deployment)
			matchingEnvironments := make(map[string]*oapi.Environment)

			for deploymentItem := range p.repo.Deployments.IterBuffered() {
				deployment := deploymentItem.Val
				if policyTarget.DeploymentSelector != nil {
					ok, _ := selector.Match(ctx, policyTarget.DeploymentSelector, deployment)
					if !ok {
						continue
					}
				}
				matchingDeployments[deployment.Id] = deployment
			}

			for environmentItem := range p.repo.Environments.IterBuffered() {
				environment := environmentItem.Val
				if policyTarget.EnvironmentSelector != nil {
					ok, _ := selector.Match(ctx, policyTarget.EnvironmentSelector, environment)
					if !ok {
						continue
					}
				}
				matchingEnvironments[environment.Id] = environment
			}

			// Now, for each deployment/environment pair, find resources that match all three conditions
			for _, deployment := range matchingDeployments {
				for _, environment := range matchingEnvironments {
					for resourceItem := range p.repo.Resources.IterBuffered() {
						resource := resourceItem.Val

						// Resource must match resourceCondition (if any)
						if policyTarget.ResourceSelector != nil {
							ok, _ := selector.Match(ctx, policyTarget.ResourceSelector, resource)
							if !ok {
								continue
							}
						}

						// Resource must be in the environment and deployment
						// (Assume you have a way to check if a resource is in an environment and deployment)
						// For this example, let's assume you have methods:
						//   p.repo.Environments.HasResource(environment.Id, resource.Id)
						//   p.repo.Deployments.HasResource(deployment.Id, resource.Id)
						ok := p.store.Environments.HasResource(environment.Id, resource.Id)
						if !ok {
							continue
						}

						ok = p.store.Deployments.HasResource(deployment.Id, resource.Id)
						if !ok {
							continue
						}

						releaseTarget := &oapi.ReleaseTarget{
							DeploymentId:  deployment.Id,
							EnvironmentId: environment.Id,
							ResourceId:    resource.Id,
						}
						releaseTargets[releaseTarget.Key()] = releaseTarget
					}
				}
			}
		}

		return releaseTargets, nil
	}
}

func (p *Policies) IterBuffered() <-chan cmap.Tuple[string, *oapi.Policy] {
	return p.repo.Policies.IterBuffered()
}

func (p *Policies) Get(id string) (*oapi.Policy, bool) {
	return p.repo.Policies.Get(id)
}

func (p *Policies) Has(id string) bool {
	return p.repo.Policies.Has(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *oapi.Policy) error {
	p.repo.Policies.Set(policy.Id, policy)
	p.releaseTargets.Set(policy.Id, materialized.New(p.recomputeReleaseTargets(policy.Id)))
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("policy", changeset.ChangeTypeInsert, policy.Id, policy)
	}
	return nil
}

func (p *Policies) Remove(ctx context.Context, id string) {
	p.repo.Policies.Remove(id)
	p.releaseTargets.Remove(id)
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("policy", changeset.ChangeTypeDelete, id, nil)
	}
}

func (p *Policies) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) []*oapi.Policy {
	policies := make([]*oapi.Policy, 0, p.repo.Policies.Count())

	for policy := range p.repo.Policies.IterBuffered() {
		policy := policy.Val
		rts, ok := p.releaseTargets.Get(policy.Id)
		if !ok {
			continue
		}

		_, ok = rts.Get()[releaseTarget.Key()]
		if !ok {
			continue
		}

		policies = append(policies, policy)
	}

	return policies
}
