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
	"go.opentelemetry.io/otel/codes"
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
	scheduler       *ReconciliationScheduler
}

// NewPlanner creates a new deployment planner.
func NewPlanner(
	store *store.Store,
	policyManager *policy.Manager,
	versionManager *versions.Manager,
	variableManager *variables.Manager,
) *Planner {
	scheduler := NewReconciliationScheduler()
	return &Planner{
		store:           store,
		policyManager:   policyManager,
		versionManager:  versionManager,
		variableManager: variableManager,
		scheduler:       scheduler,
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
	span.AddEvent("Step 1: Getting candidate versions")
	candidateVersions := p.versionManager.GetCandidateVersions(ctx, releaseTarget)
	span.SetAttributes(attribute.Int("candidate_versions.count", len(candidateVersions)))

	if len(candidateVersions) == 0 {
		span.AddEvent("No candidate versions available")
		span.SetAttributes(
			attribute.Bool("has_desired_release", false),
			attribute.String("reason", "no_versions"),
		)
		return nil, nil
	}

	// Step 2: Find first version that passes user-defined policies
	span.AddEvent("Step 2: Finding deployable version")
	deployableVersion := p.findDeployableVersion(ctx, candidateVersions, releaseTarget)
	if deployableVersion == nil {
		span.AddEvent("No deployable version found (blocked by policies)")
		span.SetAttributes(
			attribute.Bool("has_desired_release", false),
			attribute.String("reason", "blocked_by_policies"),
		)
		return nil, nil
	}

	span.SetAttributes(
		attribute.String("deployable_version.id", deployableVersion.Id),
		attribute.String("deployable_version.tag", deployableVersion.Tag),
		attribute.String("deployable_version.created_at", deployableVersion.CreatedAt.Format("2006-01-02T15:04:05Z")),
	)

	resourceRelatedEntities := cfg.resourceRelatedEntities
	if resourceRelatedEntities == nil {
		span.AddEvent("Computing resource relationships")
		resource, exists := p.store.Resources.Get(releaseTarget.ResourceId)
		if !exists {
			err := fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
			span.RecordError(err)
			span.SetStatus(codes.Error, "resource not found")
			return nil, err
		}
		entity := relationships.NewResourceEntity(resource)
		resourceRelatedEntities, _ = p.store.Relationships.GetRelatedEntities(ctx, entity)

		// Count total related entities
		totalRelatedEntities := 0
		uniqueRefs := 0
		for _, entities := range resourceRelatedEntities {
			totalRelatedEntities += len(entities)
			uniqueRefs++
		}
		span.SetAttributes(
			attribute.Int("related_entities.count", totalRelatedEntities),
			attribute.Int("related_entities.unique_refs", uniqueRefs),
		)
	} else {
		span.AddEvent("Using pre-computed resource relationships")
		totalRelatedEntities := 0
		uniqueRefs := 0
		for _, entities := range resourceRelatedEntities {
			totalRelatedEntities += len(entities)
			uniqueRefs++
		}
		span.SetAttributes(
			attribute.Int("related_entities.count", totalRelatedEntities),
			attribute.Int("related_entities.unique_refs", uniqueRefs),
			attribute.Bool("relationships.precomputed", true),
		)
	}

	// Step 3: Resolve variables for this deployment
	span.AddEvent("Step 3: Evaluating variables")
	resolvedVariables, err := p.variableManager.Evaluate(ctx, releaseTarget, resourceRelatedEntities)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "variable evaluation failed")
		return nil, err
	}
	span.SetAttributes(attribute.Int("resolved_variables.count", len(resolvedVariables)))

	// Step 4: Construct the desired release
	span.AddEvent("Step 4: Building release")
	desiredRelease := BuildRelease(ctx, releaseTarget, deployableVersion, resolvedVariables)
	span.SetAttributes(
		attribute.Bool("has_desired_release", true),
		attribute.String("release.id", desiredRelease.ID()),
	)
	span.SetStatus(codes.Ok, "planning completed successfully")

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

	span.AddEvent("Getting policies for release target")
	policies, err := p.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get policies")
		return nil
	}
	span.SetAttributes(attribute.Int("policies.count", len(policies)))

	environment, ok := p.store.Environments.Get(releaseTarget.EnvironmentId)
	if !ok {
		err := fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "environment not found")
		return nil
	}
	span.SetAttributes(attribute.String("environment.name", environment.Name))

	span.AddEvent("Building evaluators from policies")
	evaluators := p.policyManager.PlannerGlobalEvaluators()
	globalEvaluatorCount := len(evaluators)
	for _, policy := range policies {
		for _, rule := range policy.Rules {
			evaluators = append(evaluators, p.policyManager.PlannerPolicyEvaluators(&rule)...)
		}
	}
	span.SetAttributes(
		attribute.Int("evaluators.total", len(evaluators)),
		attribute.Int("evaluators.global", globalEvaluatorCount),
		attribute.Int("evaluators.policy", len(evaluators)-globalEvaluatorCount),
	)

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
	for i, eval := range versionIndependentEvals {
		result := eval.Evaluate(ctx, scope)
		if !result.Allowed {
			if result.NextEvaluationTime != nil {
				p.scheduler.Schedule(releaseTarget, *result.NextEvaluationTime)
			}

			// All versions blocked by version-independent policy
			span.AddEvent("All versions blocked by version-independent policy",
				trace.WithAttributes(
					attribute.String("message", result.Message),
					attribute.Int("evaluator_index", i),
				))
			span.SetAttributes(
				attribute.Bool("found_deployable_version", false),
				attribute.Int("blocked_by_evaluator_index", i),
			)
			return nil
		}
	}

	span.AddEvent("Evaluating version-dependent policies")
	versionsEvaluated := 0
	versionsBlocked := 0
	for _, version := range candidateVersions {
		versionsEvaluated++
		eligible := true
		scope.Version = version

		for evalIdx, eval := range versionDependentEvals {
			result := eval.Evaluate(ctx, scope)
			if !result.Allowed {
				eligible = false
				versionsBlocked++

				span.AddEvent("Version blocked by policy",
					trace.WithAttributes(
						attribute.String("version.id", version.Id),
						attribute.String("version.tag", version.Tag),
						attribute.Int("evaluator_index", evalIdx),
						attribute.String("message", result.Message),
					))

				if result.NextEvaluationTime != nil {
					p.scheduler.Schedule(releaseTarget, *result.NextEvaluationTime)
				}

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
					attribute.Int("versions_blocked", versionsBlocked),
				))
			span.SetAttributes(
				attribute.Bool("found_deployable_version", true),
				attribute.String("selected_version.id", version.Id),
				attribute.String("selected_version.tag", version.Tag),
				attribute.Int("versions_evaluated", versionsEvaluated),
				attribute.Int("versions_blocked", versionsBlocked),
			)
			span.SetStatus(codes.Ok, "found deployable version")
			return version
		}
	}

	// No eligible versions found
	span.AddEvent("No eligible versions found (all blocked by policies)",
		trace.WithAttributes(
			attribute.Int("versions_evaluated", versionsEvaluated),
			attribute.Int("versions_blocked", versionsBlocked),
		))
	span.SetAttributes(
		attribute.Bool("found_deployable_version", false),
		attribute.Int("versions_evaluated", versionsEvaluated),
		attribute.Int("versions_blocked", versionsBlocked),
	)
	span.SetStatus(codes.Ok, "no deployable version (all blocked)")
	return nil
}

func (p *Planner) Scheduler() *ReconciliationScheduler {
	return p.scheduler
}
