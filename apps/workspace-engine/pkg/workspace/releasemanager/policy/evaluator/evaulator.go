package evaluator

import (
	"context"
	"workspace-engine/pkg/oapi"
)

// ScopeFields defines which fields from EvaluatorScope an evaluator cares about.
// This determines what gets included in the cache key.
type ScopeFields int

const (
	ScopeEnvironment ScopeFields = 1 << iota
	ScopeVersion
	ScopeReleaseTarget
	ScopeRelease
)

// EvaluatorScope contains the context for policy evaluation.
// Different evaluators may only care about certain fields:
//   - Approval rules: typically Environment + Version
//   - Gradual rollout: typically Environment + Version + ReleaseTarget
//   - Skip deployed: typically Release
//   - Workspace rules: may not need any specific entities
type EvaluatorScope struct {
	Environment   *oapi.Environment
	Version       *oapi.DeploymentVersion
	ReleaseTarget *oapi.ReleaseTarget
}

// HasFields checks if this scope has all the required fields set (non-nil).
func (s EvaluatorScope) HasFields(fields ScopeFields) bool {
	if fields&ScopeEnvironment != 0 && s.Environment == nil {
		return false
	}
	if fields&ScopeVersion != 0 && s.Version == nil {
		return false
	}
	if fields&ScopeReleaseTarget != 0 && s.ReleaseTarget == nil {
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
	RuleTypePausedVersions         = "pausedVersions"
	RuleTypeDeployableVersions     = "deployableVersions"
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
