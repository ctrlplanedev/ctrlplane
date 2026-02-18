package evaluator

import (
	"context"
	"workspace-engine/pkg/oapi"
)

// ScopeFields is a bitmask that declares which EvaluatorScope fields an evaluator
// reads during evaluation. It serves two purposes:
//
//  1. Cache key generation: When wrapped with WithMemoization, only the declared
//     fields are included in the cache key. An evaluator declaring
//     ScopeEnvironment|ScopeVersion will return cached results when called with
//     different ReleaseTargets but the same Environment and Version.
//
//  2. Scope validation: Before evaluation, the memoization layer checks that all
//     declared fields are non-nil in the provided scope. If any are missing, it
//     returns a denial without calling the underlying evaluator.
//
// # Primitive vs composite fields
//
// The primitive fields are ScopeEnvironment, ScopeVersion, ScopeResource,
// ScopeDeployment, and ScopeRelease. Each corresponds to a single entity.
//
// ScopeReleaseTarget is a composite: a release target is uniquely identified by
// the combination of an environment, a resource, and a deployment. Declaring
// ScopeReleaseTarget is equivalent to ScopeEnvironment | ScopeResource |
// ScopeDeployment.
//
// # Choosing the correct value
//
// Set the bit for every EvaluatorScope field that the evaluator accesses in its
// Evaluate method. Include a field if:
//   - The evaluator reads the field directly (e.g. scope.Version.Id).
//   - The evaluator passes the field to a store lookup or external call.
//
// Do NOT include a field if:
//   - The evaluator never references it. Adding unnecessary fields reduces cache
//     hit rates by making cache keys more specific than needed.
//
// Common patterns from existing evaluators:
//   - ScopeEnvironment | ScopeVersion: rule depends on the environment/version
//     pair (e.g. approval, environment progression, soak time).
//   - ScopeVersion | ScopeReleaseTarget: rule depends on the version and the
//     specific target (e.g. deployable version status, version cooldown).
//   - ScopeEnvironment | ScopeVersion | ScopeReleaseTarget: rule depends on all
//     entities (e.g. gradual rollout, version selector).
//   - ScopeReleaseTarget: rule only depends on the target itself (e.g. deployment
//     window, deployment dependency, rollback).
//   - 0 (no bits set): rule is workspace-scoped and produces the same result
//     regardless of scope values; cached under a single "workspace" key.
type ScopeFields int

const (
	// ScopeEnvironment indicates the evaluator reads scope.Environment.
	ScopeEnvironment ScopeFields = 1 << iota
	// ScopeVersion indicates the evaluator reads scope.Version.
	ScopeVersion
	// ScopeResource indicates the evaluator reads scope.Resource.
	ScopeResource
	// ScopeDeployment indicates the evaluator reads scope.Deployment.
	ScopeDeployment

	// ScopeReleaseTarget is a convenience composite. A release target is
	// uniquely identified by an environment, a resource, and a deployment.
	// Declaring ScopeReleaseTarget is equivalent to declaring all three.
	ScopeReleaseTarget = ScopeEnvironment | ScopeResource | ScopeDeployment
)

// EvaluatorScope contains the context for policy evaluation.
// Different evaluators may only care about certain fields:
//   - Approval rules: typically Environment + Version
//   - Gradual rollout: typically Environment + Version + ReleaseTarget
//   - Skip deployed: typically Release
//   - Workspace rules: may not need any specific entities
type EvaluatorScope struct {
	Environment *oapi.Environment
	Version     *oapi.DeploymentVersion
	Resource    *oapi.Resource
	Deployment  *oapi.Deployment
}

// ReleaseTarget constructs an oapi.ReleaseTarget from the scope's
// Environment, Resource, and Deployment fields.
func (s EvaluatorScope) ReleaseTarget() *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: s.Environment.Id,
		ResourceId:    s.Resource.Id,
		DeploymentId:  s.Deployment.Id,
	}
}

// HasFields checks if this scope has all the required fields set (non-nil).
// Each scope field maps directly to its corresponding struct field.
func (s EvaluatorScope) HasFields(fields ScopeFields) bool {
	if fields&ScopeEnvironment != 0 && s.Environment == nil {
		return false
	}
	if fields&ScopeVersion != 0 && s.Version == nil {
		return false
	}
	if fields&ScopeResource != 0 && s.Resource == nil {
		return false
	}
	if fields&ScopeDeployment != 0 && s.Deployment == nil {
		return false
	}

	return true
}

// Evaluator evaluates a policy rule against a given scope.
// The same evaluator can be called multiple times with different scopes.
type Evaluator interface {
	Evaluate(ctx context.Context, scope EvaluatorScope) *oapi.RuleEvaluation
	// ScopeFields returns which fields from EvaluatorScope this evaluator uses for caching.
	// This determines the cache key when wrapped with memoization.
	ScopeFields() ScopeFields
	// RuleType returns the type identifier for this evaluator (e.g., "approval", "gradualRollout").
	// This is used for policy bypass matching.
	RuleType() string

	RuleId() string

	Complexity() int
}

// Rule type constants for policy bypass matching
const (
	RuleTypeApproval               = "approval"
	RuleTypeEnvironmentProgression = "environmentProgression"
	RuleTypeGradualRollout         = "gradualRollout"
	RuleTypeRetry                  = "retry"
	RuleTypeDeployableVersions     = "deployableVersions"
	RuleTypeDeploymentWindow       = "deploymentWindow"
	RuleTypeVersionCooldown        = "versionCooldown"
	RuleTypeRollback               = "rollback"
)

// WithMemoization wraps an evaluator with caching based on its declared scope fields.
// This is the recommended way to enable caching - the evaluator declares what it needs.
func WithMemoization(eval Evaluator) Evaluator {
	if eval == nil {
		return nil
	}
	return NewMemoized(eval, eval.ScopeFields())
}

// CollectWithMemoization wraps each evaluator with memoization and filters out nils.
// Each evaluator is cached based on its own declared scope fields.
func CollectEvaluators(evals ...Evaluator) []Evaluator {
	result := make([]Evaluator, 0, len(evals))
	for _, eval := range evals {
		if eval != nil {
			result = append(result, eval)
		}
	}
	return result
}

type JobEvaluator interface {
	Evaluate(ctx context.Context, release *oapi.Release) *oapi.RuleEvaluation
}
