// Package deployment handles deployment planning and execution.
// It provides the two-phase deployment pattern: planning (read-only) and execution (writes).
package deployment

import (
	"context"
	"fmt"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/deployment")

// DeploymentDecision represents a deployment decision with ability to check if deployment is allowed.
type DeploymentDecision interface {
	CanDeploy() bool
}

// Planner handles deployment planning (Phase 1: DECISION - Read-only operations).
type Planner struct {
	store           *store.Store
	policyManager   *policy.Manager
	versionManager  *versions.Manager
	variableManager *variables.Manager
}

// NewPlanner creates a new deployment planner.
func NewPlanner(
	store *store.Store,
	policyManager *policy.Manager,
	versionManager *versions.Manager,
	variableManager *variables.Manager,
) *Planner {
	return &Planner{
		store:           store,
		policyManager:   policyManager,
		versionManager:  versionManager,
		variableManager: variableManager,
	}
}

// PlanDeployment determines the desired release for a target based on user-defined policies (READ-ONLY).
//
// This function focuses on determining WHAT should be deployed:
//  1. Which version should be deployed (based on version availability and user policies)
//  2. What variables should be used
//
// Returns nil if:
//   - No versions available
//   - All versions are blocked by user-defined policies (approval, environment progression, etc.)
//
// Note: This does NOT check job eligibility (retry logic, duplicate prevention, etc.)
// Those checks are handled separately by JobEligibilityChecker.
//
// Returns:
//   - *oapi.Release: The desired release to deploy
//   - nil: No deployable release (no versions or all blocked by policies)
//   - error: Planning failed
//
// Design Pattern: Three-Phase Deployment (PLANNING Phase)
// This function only READS state and determines the desired release. No writes occur here.
func (p *Planner) PlanDeployment(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "PlanDeployment",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	// Step 1: Get candidate versions (sorted newest to oldest)
	candidateVersions := p.versionManager.GetCandidateVersions(ctx, releaseTarget)
	if len(candidateVersions) == 0 {
		return nil, nil
	}

	// Step 2: Find first version that passes user-defined policies
	deployableVersion := p.findDeployableVersion(ctx, candidateVersions, releaseTarget)
	if deployableVersion == nil {
		return nil, nil
	}

	// Step 3: Resolve variables for this deployment
	resolvedVariables, err := p.variableManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	// Step 4: Construct the desired release
	desiredRelease := BuildRelease(ctx, releaseTarget, deployableVersion, resolvedVariables)

	return desiredRelease, nil
}

// partitionEvaluatorsByVersionDependency separates evaluators into two groups:
// version-independent evaluators (can be checked once) and version-dependent
// evaluators (must be checked per version).
func (p *Planner) partitionEvaluatorsByVersionDependency(
	ctx context.Context,
	evaluators []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) (versionIndependent []evaluator.Evaluator, versionDependent []evaluator.Evaluator) {
	_, span := tracer.Start(ctx, "partitionEvaluatorsByVersionDependency")
	defer span.End()

	versionIndependent = make([]evaluator.Evaluator, 0, len(evaluators))
	versionDependent = make([]evaluator.Evaluator, 0, len(evaluators))

	for _, eval := range evaluators {
		scopeFields := eval.ScopeFields()
		// Check if evaluator needs version field
		needsVersion := false
		if scopeFields&evaluator.ScopeVersion != 0 {
			needsVersion = true
		}

		if needsVersion {
			// Only check HasFields once per evaluator
			if scope.HasFields(scopeFields) || true { // Will check with version later
				versionDependent = append(versionDependent, eval)
			}
		} else {
			// Check HasFields once for non-version evaluators
			if scope.HasFields(scopeFields) {
				versionIndependent = append(versionIndependent, eval)
			}
		}
	}

	span.SetAttributes(attribute.Int("versionIndependent.count", len(versionIndependent)))
	span.SetAttributes(attribute.Int("versionDependent.count", len(versionDependent)))

	return versionIndependent, versionDependent
}

// findDeployableVersion finds the first version that passes all checks (READ-ONLY).
// Checks include:
//   - System-level version checks (e.g., version status via evaluators)
//   - User-defined policies (approval requirements, environment progression, etc.)
//
// Returns nil if all versions are blocked by policies or system checks.
func (p *Planner) findDeployableVersion(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	ctx, span := tracer.Start(ctx, "findDeployableVersion")
	defer span.End()

	policies, err := p.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil
	}

	environment, ok := p.store.Environments.Get(releaseTarget.EnvironmentId)
	if !ok {
		span.RecordError(fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId))
		return nil
	}

	evaluators := p.policyManager.PlannerGlobalEvaluators()
	for _, policy := range policies {
		for _, rule := range policy.Rules {
			evaluators = append(evaluators, p.policyManager.PlannerPolicyEvaluators(&rule)...)
		}
	}

	scope := evaluator.EvaluatorScope{
		Environment:   environment,
		ReleaseTarget: releaseTarget,
	}

	versionIndependentEvals, versionDependentEvals := p.partitionEvaluatorsByVersionDependency(ctx, evaluators, scope)

	// Now check version-independent evaluators once upfront
	for _, eval := range versionIndependentEvals {
		result := eval.Evaluate(ctx, scope)
		if !result.Allowed {
			// All versions blocked by version-independent policy
			return nil
		}
	}

	// Evaluate all versions in parallel and find first eligible one
	return p.findFirstEligibleVersion(ctx, candidateVersions, versionDependentEvals, scope)
}

// versionEligibilityResult holds the result of evaluating a version's eligibility.
type versionEligibilityResult struct {
	version  *oapi.DeploymentVersion
	eligible bool
}

// findFirstEligibleVersion evaluates all candidate versions in parallel and returns
// the first eligible version (in order). Returns nil if no versions are eligible.
func (p *Planner) findFirstEligibleVersion(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	versionDependentEvals []evaluator.Evaluator,
	baseScope evaluator.EvaluatorScope,
) *oapi.DeploymentVersion {
	ctx, span := tracer.Start(ctx, "findFirstEligibleVersion",
		trace.WithAttributes(
			attribute.Int("candidateVersions.count", len(candidateVersions)),
			attribute.Int("versionDependentEvals.count", len(versionDependentEvals)),
		))
	defer span.End()

	if len(candidateVersions) == 0 {
		return nil
	}

	// Process versions in parallel using chunks to prevent system overload
	// Based on common patterns in the codebase: chunk size 50, max concurrency 10
	results, err := concurrency.ProcessInChunks(
		candidateVersions,
		50, // chunk size
		10, // max concurrent goroutines
		func(version *oapi.DeploymentVersion) (versionEligibilityResult, error) {
			// Create a copy of the scope for this version
			scope := baseScope
			scope.Version = version

			// Check all version-dependent evaluators
			eligible := true
			for _, eval := range versionDependentEvals {
				result := eval.Evaluate(ctx, scope)
				if !result.Allowed {
					eligible = false
					break
				}
			}

			return versionEligibilityResult{
				version:  version,
				eligible: eligible,
			}, nil
		},
	)

	if err != nil {
		span.RecordError(err)
		return nil
	}

	// Find first eligible version (order is preserved by ProcessInChunks)
	for _, result := range results {
		if result.eligible {
			span.SetAttributes(attribute.String("selectedVersion.id", result.version.Id))
			return result.version
		}
	}

	// No eligible versions found
	return nil
}
