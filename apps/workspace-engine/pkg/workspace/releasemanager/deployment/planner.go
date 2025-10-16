// Package deployment handles deployment planning and execution.
// It provides the two-phase deployment pattern: planning (read-only) and execution (writes).
package deployment

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"

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
	policyManager   *policy.Manager
	versionManager  *versions.Manager
	variableManager *variables.Manager
}

// NewPlanner creates a new deployment planner.
func NewPlanner(
	policyManager *policy.Manager,
	versionManager *versions.Manager,
	variableManager *variables.Manager,
) *Planner {
	return &Planner{
		policyManager:   policyManager,
		versionManager:  versionManager,
		variableManager: variableManager,
	}
}

// PlanDeployment determines what release (if any) should be deployed for a target (READ-ONLY).
//
// Planning Logic - Returns nil if ANY of these are true:
//  1. No versions available for this deployment
//  2. All versions are blocked by policies
//  3. Latest passing version is already deployed (most recent successful job)
//  4. Job already in progress for this release (pending/in-progress job exists)
//
// Returns:
//   - *oapi.Release: This release should be deployed (caller should create a job for it)
//   - nil: No deployment needed (see planning logic above)
//   - error: Planning failed
//
// Design Pattern: Two-Phase Deployment (DECISION Phase)
// This function only READS state and makes decisions. No writes occur here.
// If this returns a release, the executor will handle the actual deployment.
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

	// Step 2: Find first version that passes ALL policies
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

	// Step 5: Evaluate the release against policies
	policyDecision, err := p.policyManager.EvaluateRelease(ctx, desiredRelease)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	if !policyDecision.CanDeploy() {
		return nil, nil
	}

	// This release needs to be deployed!
	span.SetAttributes(attribute.Bool("needs_deployment", true))

	return desiredRelease, nil
}

// findDeployableVersion finds the first version that passes all policies (READ-ONLY).
// Returns nil if all versions are blocked by policies.
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
