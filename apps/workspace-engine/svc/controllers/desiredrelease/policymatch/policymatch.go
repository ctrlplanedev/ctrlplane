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

// evalSelector compiles and evaluates a CEL selector against the target,
// handling fast-path literals. Returns (matched, valid).
func evalSelector(selector string, target *Target) (matched, valid bool) {
	switch selector {
	case "":
		return false, true
	case "true":
		return true, true
	case "false":
		return false, true
	}

	program, err := celLang.CompileProgram(selector)
	if err != nil {
		return false, false
	}

	result, _ := celutil.EvalBool(program, target.celContext())
	return result, true
}

// Filter returns the subset of policies whose CEL selectors match the target.
// Policies that share the same selector string are evaluated only once.
func Filter(_ context.Context, policies []*oapi.Policy, target *Target) []*oapi.Policy {
	evaluated := make(map[string]bool, len(policies))
	applicable := make([]*oapi.Policy, 0, len(policies))

	for _, p := range policies {
		if p == nil {
			continue
		}

		result, seen := evaluated[p.Selector]
		if !seen {
			result, _ = evalSelector(p.Selector, target)
			evaluated[p.Selector] = result
		}

		if result {
			applicable = append(applicable, p)
		}
	}

	return applicable
}
