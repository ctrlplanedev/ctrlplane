package evaluator

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
)

// MemoizedEvaluator wraps an evaluator and caches results based on the scope fields it cares about.
// For example, an approval rule that only cares about Environment+Version will cache based on those
// fields, so calling it with different ReleaseTargets will return the cached result.
type MemoizedEvaluator struct {
	evaluator   Evaluator
	scopeFields ScopeFields
	mu          sync.RWMutex
	cache       map[string]*oapi.RuleEvaluation
}

// NewMemoized creates a memoized evaluator that caches based on the specified scope fields.
//
// Example:
//   // Approval rule only cares about Environment + Version
//   memoized := NewMemoized(approvalEval, ScopeEnvironment|ScopeVersion)
//
//   // Will evaluate once
//   result1, _ := memoized.Evaluate(ctx, EvaluatorScope{env1, v1, target1, nil})
//   // Will return cached (same env+version, target ignored)
//   result2, _ := memoized.Evaluate(ctx, EvaluatorScope{env1, v1, target2, nil})
func NewMemoized(evaluator Evaluator, scopeFields ScopeFields) *MemoizedEvaluator {
	return &MemoizedEvaluator{
		evaluator:   evaluator,
		scopeFields: scopeFields,
		cache:       make(map[string]*oapi.RuleEvaluation),
	}
}

// ScopeFields returns the scope fields this memoized evaluator uses for caching.
func (m *MemoizedEvaluator) ScopeFields() ScopeFields {
	return m.scopeFields
}

// Evaluate returns the cached result if the relevant scope fields match,
// otherwise evaluates and caches the result.
// If the scope doesn't have the required fields, returns a denial without calling the evaluator.
func (m *MemoizedEvaluator) Evaluate(ctx context.Context, scope EvaluatorScope) *oapi.RuleEvaluation {
	// Validate that the scope has all required fields
	if !scope.HasFields(m.scopeFields) {
		return m.buildMissingFieldsResult(scope)
	}

	cacheKey := m.buildCacheKey(scope)

	// Check cache with read lock
	m.mu.RLock()
	if result, exists := m.cache[cacheKey]; exists {
		m.mu.RUnlock()
		return result
	}
	m.mu.RUnlock()

	// Not in cache, acquire write lock and evaluate
	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if result, exists := m.cache[cacheKey]; exists {
		return result
	}

	// Evaluate
	result := m.evaluator.Evaluate(ctx, scope)

	// Cache the result
	m.cache[cacheKey] = result
	return result
}

// buildCacheKey creates a cache key from only the scope fields this evaluator cares about.
func (m *MemoizedEvaluator) buildCacheKey(scope EvaluatorScope) string {
	var key string

	if m.scopeFields&ScopeEnvironment != 0 && scope.Environment != nil {
		key += fmt.Sprintf("env:%s|", scope.Environment.Id)
	}

	if m.scopeFields&ScopeVersion != 0 && scope.Version != nil {
		key += fmt.Sprintf("ver:%s|", scope.Version.Id)
	}

	if m.scopeFields&ScopeReleaseTarget != 0 && scope.ReleaseTarget != nil {
		key += fmt.Sprintf("tgt:%s|", scope.ReleaseTarget.Key())
	}

	if m.scopeFields&ScopeRelease != 0 && scope.Release != nil {
		key += fmt.Sprintf("rel:%s|", scope.Release.ID())
	}

	if key == "" {
		return "workspace" // Workspace-scoped (no specific entities)
	}

	return key
}

// buildMissingFieldsResult creates a denial result when required scope fields are missing.
func (m *MemoizedEvaluator) buildMissingFieldsResult(scope EvaluatorScope) *oapi.RuleEvaluation {
	missing := []string{}

	if m.scopeFields&ScopeEnvironment != 0 && scope.Environment == nil {
		missing = append(missing, "Environment")
	}
	if m.scopeFields&ScopeVersion != 0 && scope.Version == nil {
		missing = append(missing, "Version")
	}
	if m.scopeFields&ScopeReleaseTarget != 0 && scope.ReleaseTarget == nil {
		missing = append(missing, "ReleaseTarget")
	}
	if m.scopeFields&ScopeRelease != 0 && scope.Release == nil {
		missing = append(missing, "Release")
	}

	message := fmt.Sprintf("Evaluator requires %s but scope is missing: %s",
		m.scopeFieldsString(),
		strings.Join(missing, ", "))

	return results.NewDeniedResult(message).
		WithDetail("missing_fields", missing).
		WithDetail("required_fields", m.scopeFieldsString())
}

// scopeFieldsString returns a human-readable string of the required scope fields.
func (m *MemoizedEvaluator) scopeFieldsString() string {
	fields := []string{}
	if m.scopeFields&ScopeEnvironment != 0 {
		fields = append(fields, "Environment")
	}
	if m.scopeFields&ScopeVersion != 0 {
		fields = append(fields, "Version")
	}
	if m.scopeFields&ScopeReleaseTarget != 0 {
		fields = append(fields, "ReleaseTarget")
	}
	if m.scopeFields&ScopeRelease != 0 {
		fields = append(fields, "Release")
	}
	return strings.Join(fields, "+")
}
