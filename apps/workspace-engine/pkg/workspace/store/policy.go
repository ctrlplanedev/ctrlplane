package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"

	"google.golang.org/protobuf/types/known/structpb"
)

func NewPolicies(store *Store) *Policies {
	return &Policies{
		repo:           store.repo,
		store:          store,
		releaseTargets: cmap.New[*materialized.MaterializedView[map[string]*pb.ReleaseTarget]](),
	}
}

type Policies struct {
	repo           *repository.Repository
	store          *Store
	releaseTargets cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.ReleaseTarget]]
}

func (p *Policies) Items() map[string]*pb.Policy {
	return p.repo.Policies.Items()
}

func parseSelector(selector *structpb.Struct) (util.MatchableCondition, error) {
	if selector == nil {
		return nil, nil
	}

	unknownCondition, err := unknown.ParseFromMap(selector.AsMap())
	if err != nil {
		return nil, fmt.Errorf("failed to parse selector: %w", err)
	}
	return jsonselector.ConvertToSelector(context.Background(), unknownCondition)
}

func (p *Policies) recomputeReleaseTargets(policyId string) materialized.RecomputeFunc[map[string]*pb.ReleaseTarget] {
	return func(ctx context.Context) (map[string]*pb.ReleaseTarget, error) {
		policy, ok := p.Get(policyId)
		if !ok {
			return nil, fmt.Errorf("policy %s not found", policyId)
		}

		releaseTargets := make(map[string]*pb.ReleaseTarget)

		for _, policyTarget := range policy.GetSelectors() {
			jsonDeploymentSelector := policyTarget.DeploymentSelector.GetJson()
			jsonEnvironmentSelector := policyTarget.EnvironmentSelector.GetJson()
			jsonResourceSelector := policyTarget.ResourceSelector.GetJson()

			deploymentCondition, _ := parseSelector(jsonDeploymentSelector)
			environmentCondition, _ := parseSelector(jsonEnvironmentSelector)
			resourceCondition, _ := parseSelector(jsonResourceSelector)

			// Build sets of matching deployments and environments
			matchingDeployments := make(map[string]*pb.Deployment)
			matchingEnvironments := make(map[string]*pb.Environment)

			for deploymentItem := range p.repo.Deployments.IterBuffered() {
				deployment := deploymentItem.Val
				if deploymentCondition != nil {
					ok, err := deploymentCondition.Matches(deployment)
					if err != nil {
						return nil, fmt.Errorf("error matching deployment %s for policy %s: %w", deployment.Id, policyId, err)
					}
					if !ok {
						continue
					}
				}
				matchingDeployments[deployment.Id] = deployment
			}

			for environmentItem := range p.repo.Environments.IterBuffered() {
				environment := environmentItem.Val
				if environmentCondition != nil {
					ok, err := environmentCondition.Matches(environment)
					if err != nil {
						return nil, fmt.Errorf("error matching environment %s for policy %s: %w", environment.Id, policyId, err)
					}
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
						if resourceCondition != nil {
							ok, err := resourceCondition.Matches(resource)
							if err != nil {
								return nil, fmt.Errorf("error matching resource %s for policy %s: %w", resource.Id, policyId, err)
							}
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

						releaseTarget := &pb.ReleaseTarget{
							DeploymentId:  deployment.Id,
							EnvironmentId: environment.Id,
							ResourceId:    resource.Id,
						}
						releaseTarget.Id = releaseTarget.Key()
						releaseTargets[releaseTarget.Key()] = releaseTarget
					}
				}
			}
		}

		return releaseTargets, nil
	}
}

func (p *Policies) IterBuffered() <-chan cmap.Tuple[string, *pb.Policy] {
	return p.repo.Policies.IterBuffered()
}

func (p *Policies) Get(id string) (*pb.Policy, bool) {
	return p.repo.Policies.Get(id)
}

func (p *Policies) Has(id string) bool {
	return p.repo.Policies.Has(id)
}

func (p *Policies) Upsert(ctx context.Context, policy *pb.Policy) error {
	p.repo.Policies.Set(policy.Id, policy)
	p.releaseTargets.Set(policy.Id, materialized.New(p.recomputeReleaseTargets(policy.Id)))
	return nil
}

func (p *Policies) Remove(id string) {
	p.repo.Policies.Remove(id)
	p.releaseTargets.Remove(id)
}

func (p *Policies) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *pb.ReleaseTarget) []*pb.Policy {
	policies := make([]*pb.Policy, 0, p.repo.Policies.Count())

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
