package policy

import "context"

type PolicyEngine struct {
}

func (e *PolicyEngine) Evaluate(ctx context.Context, target ReleaseTarget) (bool, error) {
	return false, nil
}
