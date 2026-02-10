package selector

import (
	"context"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	celLang "workspace-engine/pkg/selector/langs/cel"
)

func NewResolvedReleaseTarget(environment *oapi.Environment, deployment *oapi.Deployment, resource *oapi.Resource) *ResolvedReleaseTarget {
	return &ResolvedReleaseTarget{
		environment: environment,
		deployment:  deployment,
		resource:    resource,
	}
}

type ResolvedReleaseTarget struct {
	environment *oapi.Environment
	deployment  *oapi.Deployment
	resource    *oapi.Resource
	celCtx      map[string]any
}

func (b *ResolvedReleaseTarget) Environment() *oapi.Environment {
	return b.environment
}

func (b *ResolvedReleaseTarget) Deployment() *oapi.Deployment {
	return b.deployment
}

func (b *ResolvedReleaseTarget) Resource() *oapi.Resource {
	return b.resource
}

// CelContext returns the CEL evaluation context for this release target,
// lazily building and caching it on first access. This avoids redundant
// map construction when matching the same target against multiple policies.
func (b *ResolvedReleaseTarget) CelContext() map[string]any {
	if b.celCtx == nil {
		b.celCtx = celLang.BuildEntityContext(b.resource, b.deployment, b.environment)
	}
	return b.celCtx
}

// MatchPolicy evaluates a policy's CEL selector against a resolved release
// target. An empty selector does not match anything. A "true" selector matches
// everything.
func MatchPolicy(_ context.Context, policy *oapi.Policy, releaseTarget *ResolvedReleaseTarget) bool {
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

	result, _ := celutil.EvalBool(program, releaseTarget.CelContext())
	return result
}
