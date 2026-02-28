package policymatch

import (
	"context"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	celLang "workspace-engine/pkg/selector/langs/cel"
)

// Target holds the resolved entities that define a release target for policy
// matching. The CEL context is built lazily and cached.
type Target struct {
	Environment *oapi.Environment
	Deployment  *oapi.Deployment
	Resource    *oapi.Resource
	celCtx      map[string]any
}

func (t *Target) celContext() map[string]any {
	if t.celCtx == nil {
		t.celCtx = celLang.BuildEntityContext(t.Resource, t.Deployment, t.Environment)
	}
	return t.celCtx
}

// Match evaluates a single policy's CEL selector against the target.
func Match(_ context.Context, policy *oapi.Policy, target *Target) bool {
	if policy.Selector == "" {
		return false
	}
	if policy.Selector == "true" {
		return true
	}
	if policy.Selector == "false" {
		return false
	}

	program, err := celLang.CompileProgram(policy.Selector)
	if err != nil {
		return false
	}

	result, _ := celutil.EvalBool(program, target.celContext())
	return result
}

// Filter returns the subset of policies whose CEL selectors match the target.
func Filter(ctx context.Context, policies []*oapi.Policy, target *Target) []*oapi.Policy {
	var applicable []*oapi.Policy
	for _, p := range policies {
		if p != nil && Match(ctx, p, target) {
			applicable = append(applicable, p)
		}
	}
	return applicable
}
