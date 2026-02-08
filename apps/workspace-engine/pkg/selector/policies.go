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

// MatchPolicy evaluates a policy's CEL selector against a resolved release
// target. An empty or "true" selector matches everything.
func MatchPolicy(_ context.Context, policy *oapi.Policy, releaseTarget *ResolvedReleaseTarget) bool {
	if policy.Selector == "" || policy.Selector == "true" {
		return true
	}

	program, err := celLang.CompileProgram(policy.Selector)
	if err != nil {
		return false
	}

	celCtx := celLang.BuildEntityContext(releaseTarget.Resource(), releaseTarget.Deployment(), releaseTarget.Environment())
	result, _ := celutil.EvalBool(program, celCtx)
	return result
}
