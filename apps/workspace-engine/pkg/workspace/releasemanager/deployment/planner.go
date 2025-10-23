// Package deployment handles deployment planning and execution.
// It provides the two-phase deployment pattern: planning (read-only) and execution (writes).
package deployment

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
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

	// System-level version evaluators (e.g., version status checks)
	versionEvaluators []evaluator.VersionScopedEvaluator
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
		versionEvaluators: []evaluator.VersionScopedEvaluator{
			deployableversions.NewDeployableVersionStatusEvaluator(store),
		},
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

	// This is the desired release based on policies!
	span.SetAttributes(attribute.Bool("has_desired_release", true))

	return desiredRelease, nil
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

	policies, err := p.policyManager.GetPoliciesForReleaseTarget(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil
	}

	workspaceDecision, err := p.policyManager.EvaluateWorkspace(ctx, policies)
	if err != nil {
		span.RecordError(err)
		return nil
	}

	if !workspaceDecision.CanDeploy() {
		return nil
	}

	for _, version := range candidateVersions {
		// Step 1: Evaluate system-level version checks (e.g., version status)
		eligible := true
		for _, versionEvaluator := range p.versionEvaluators {
			result, err := versionEvaluator.Evaluate(ctx, releaseTarget, version)
			if err != nil {
				span.RecordError(err)
				eligible = false
				break
			}
			if !result.Allowed {
				eligible = false
				break
			}
		}

		if !eligible {
			continue // Skip this version
		}

		// Step 2: Check user-defined policies
		policyDecision, err := p.policyManager.EvaluateVersion(ctx, version, releaseTarget)
		if err != nil {
			span.RecordError(err)
			continue // Skip this version on error
		}
		if policyDecision.CanDeploy() {
			return version
		}
	}

	return nil
}
