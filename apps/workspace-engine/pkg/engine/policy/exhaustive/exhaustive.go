package exhaustive

import (
	"context"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"
)

type ExhaustivePolicySelectorEngine struct {
	Policies map[string]policy.Policy

	deploymentSelectorEngine  selector.SelectorEngine[deployment.Deployment, selector.Selector]
	environmentSelectorEngine selector.SelectorEngine[environment.Environment, selector.Selector]
	resourceSelectorEngine    selector.SelectorEngine[resource.Resource, selector.Selector]
}

func (e *ExhaustivePolicySelectorEngine) LoadPolicies(ctx context.Context, policies []Policy) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, policy := range policies {
		e.Policies[policy.ID] = policy
	}
}
