// Package deployment handles deployment planning and execution.
// It provides the two-phase deployment pattern: planning (read-only) and execution (writes).
package deployment

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
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

type planDeploymentOptions func(*planDeploymentConfig)

type planDeploymentConfig struct {
	resourceRelatedEntities map[string][]*oapi.EntityRelation
}

func WithResourceRelatedEntities(entities map[string][]*oapi.EntityRelation) planDeploymentOptions {
	return func(cfg *planDeploymentConfig) {
		cfg.resourceRelatedEntities = entities
	}
}
// Returns:
//   - *oapi.Release: The desired release to deploy
//   - nil: No deployable release (no versions or all blocked by policies)
//   - error: Planning failed
//
// Design Pattern: Three-Phase Deployment (PLANNING Phase)
// This function only READS state and determines the desired release. No writes occur here.
func (p *Planner) PlanDeployment(ctx context.Context, releaseTarget *oapi.ReleaseTarget, options ...planDeploymentOptions) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "PlanDeployment",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	// Apply options
	cfg := &planDeploymentConfig{}
	for _, opt := range options {
		opt(cfg)
	}

	// Step 1: Get candidate versions (sorted newest to oldest)
	span.AddEvent("Getting candidate versions")
	candidateVersions := p.versionManager.GetCandidateVersions(ctx, releaseTarget)
	span.SetAttributes(attribute.Int("candidate_versions.count", len(candidateVersions)))
	
	if len(candidateVersions) == 0 {
		span.AddEvent("No candidate versions available")
		span.SetAttributes(attribute.Bool("has_desired_release", false))
		return nil, nil
	}

	// Step 2: Find first version that passes user-defined policies
	span.AddEvent("Finding deployable version")
	deployableVersion := p.findDeployableVersion(ctx, candidateVersions, releaseTarget)
	if deployableVersion == nil {
		span.AddEvent("No deployable version found (blocked by policies)")
		span.SetAttributes(attribute.Bool("has_desired_release", false))
		return nil, nil
	}
	
	span.SetAttributes(
		attribute.String("deployable_version.id", deployableVersion.Id),
		attribute.String("deployable_version.tag", deployableVersion.Tag),
	)

	resourceRelatedEntities := cfg.resourceRelatedEntities
	if resourceRelatedEntities == nil {
		span.AddEvent("Computing resource relationships")
		resource, exists := p.store.Resources.Get(releaseTarget.ResourceId)
		if !exists {
			return nil, fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
		}
		entity := relationships.NewResourceEntity(resource)
		resourceRelatedEntities, _ = p.store.Relationships.GetRelatedEntities(ctx, entity)
		
		// Count total related entities
		totalRelatedEntities := 0
		for _, entities := range resourceRelatedEntities {
			totalRelatedEntities += len(entities)
		}
		span.SetAttributes(attribute.Int("related_entities.count", totalRelatedEntities))
	} else {
		span.AddEvent("Using pre-computed resource relationships")
	}

	// Step 3: Resolve variables for this deployment
	span.AddEvent("Evaluating variables")
	resolvedVariables, err := p.variableManager.Evaluate(ctx, releaseTarget, resourceRelatedEntities)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	span.SetAttributes(attribute.Int("resolved_variables.count", len(resolvedVariables)))

	// Step 4: Construct the desired release
	span.AddEvent("Building release")
	desiredRelease := BuildRelease(ctx, releaseTarget, deployableVersion, resolvedVariables)
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
	ctx, span := tracer.Start(ctx, "findDeployableVersion",
		trace.WithAttributes(
			attribute.Int("candidate_versions.count", len(candidateVersions)),
		))
	defer span.End()

	policies, err := p.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil
	}
	span.SetAttributes(attribute.Int("policies.count", len(policies)))

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
	span.SetAttributes(attribute.Int("evaluators.total", len(evaluators)))

	scope := evaluator.EvaluatorScope{
		Environment:   environment,
		ReleaseTarget: releaseTarget,
	}

	versionIndependentEvals := make([]evaluator.Evaluator, 0, len(evaluators))
	versionDependentEvals := make([]evaluator.Evaluator, 0, len(evaluators))

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
				versionDependentEvals = append(versionDependentEvals, eval)
			}
		} else {
			// Check HasFields once for non-version evaluators
			if scope.HasFields(scopeFields) {
				versionIndependentEvals = append(versionIndependentEvals, eval)
			}
		}
	}

	span.SetAttributes(
		attribute.Int("evaluators.version_independent", len(versionIndependentEvals)),
		attribute.Int("evaluators.version_dependent", len(versionDependentEvals)),
	)

	// Now check version-independent evaluators once upfront
	span.AddEvent("Evaluating version-independent policies")
	for _, eval := range versionIndependentEvals {
		result := eval.Evaluate(ctx, scope)
		if !result.Allowed {
			// All versions blocked by version-independent policy
			span.AddEvent("All versions blocked by version-independent policy",
				trace.WithAttributes(attribute.String("message", result.Message)))
			span.SetAttributes(attribute.Bool("found_deployable_version", false))
			return nil
		}
	}

	span.AddEvent("Evaluating version-dependent policies")
	versionsEvaluated := 0
	for _, version := range candidateVersions {
		versionsEvaluated++
		eligible := true
		scope.Version = version

		for _, eval := range versionDependentEvals {
			result := eval.Evaluate(ctx, scope)
			if !result.Allowed {
				eligible = false
				span.AddEvent("Version blocked by policy",
					trace.WithAttributes(
						attribute.String("version.id", version.Id),
						attribute.String("version.tag", version.Tag),
						attribute.String("message", result.Message),
					))
				break
			}
		}

		if eligible {
			// Found a deployable version!
			span.AddEvent("Found deployable version",
				trace.WithAttributes(
					attribute.String("version.id", version.Id),
					attribute.String("version.tag", version.Tag),
					attribute.Int("versions_evaluated", versionsEvaluated),
				))
			span.SetAttributes(
				attribute.Bool("found_deployable_version", true),
				attribute.String("selected_version.id", version.Id),
				attribute.String("selected_version.tag", version.Tag),
			)
			return version
		}
	}

	// No eligible versions found
	span.AddEvent("No eligible versions found (all blocked by policies)",
		trace.WithAttributes(attribute.Int("versions_evaluated", versionsEvaluated)))
	span.SetAttributes(attribute.Bool("found_deployable_version", false))
	return nil
}
