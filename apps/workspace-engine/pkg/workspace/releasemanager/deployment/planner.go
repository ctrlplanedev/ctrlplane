// Package deployment handles deployment planning and execution.
// It provides the two-phase deployment pattern: planning (read-only) and execution (writes).
package deployment

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
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
	resourceRelatedEntities      map[string][]*oapi.EntityRelation
	recorder                     *trace.ReconcileTarget
	earliestVersionForEvaluation *oapi.DeploymentVersion
	forceDeployVersion           *oapi.DeploymentVersion
}

func WithResourceRelatedEntities(entities map[string][]*oapi.EntityRelation) planDeploymentOptions {
	return func(cfg *planDeploymentConfig) {
		cfg.resourceRelatedEntities = entities
	}
}

func WithTraceRecorder(recorder *trace.ReconcileTarget) planDeploymentOptions {
	return func(cfg *planDeploymentConfig) {
		cfg.recorder = recorder
	}
}

func WithVersionAndNewer(version *oapi.DeploymentVersion) planDeploymentOptions {
	return func(cfg *planDeploymentConfig) {
		cfg.earliestVersionForEvaluation = version
	}
}

func WithForceDeployVersion(version *oapi.DeploymentVersion) planDeploymentOptions {
	return func(cfg *planDeploymentConfig) {
		cfg.forceDeployVersion = version
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
		oteltrace.WithAttributes(
			attribute.String("release-target.key", releaseTarget.Key()),
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

	// Start planning phase trace if recorder is available
	var planning *trace.PlanningPhase
	if cfg.recorder != nil {
		planning = cfg.recorder.StartPlanning()
		defer planning.End()
	}

	// Step 1: Get candidate versions (sorted newest to oldest)
	span.AddEvent("Step 1: Getting candidate versions")
	candidateVersions := p.versionManager.GetCandidateVersions(ctx, releaseTarget, cfg.earliestVersionForEvaluation)
	span.SetAttributes(attribute.Int("candidate_versions.count", len(candidateVersions)))

	if len(candidateVersions) == 0 {
		if planning != nil {
			planning.MakeDecision("No versions available for deployment", trace.DecisionRejected)
		}

		span.AddEvent("No candidate versions available")
		span.SetAttributes(
			attribute.Bool("has_desired_release", false),
			attribute.String("reason", "no_versions"),
		)
		return nil, nil
	}

	deployableVersion := cfg.forceDeployVersion

	// Step 2: Find first version that passes user-defined policies
	if deployableVersion == nil {
		span.AddEvent("Step 2: Finding deployable version")
		deployableVersion = p.findDeployableVersion(ctx, candidateVersions, releaseTarget, planning)
	}

	if deployableVersion == nil {
		span.AddEvent("No deployable version found (blocked by policies)")
		span.SetAttributes(
			attribute.Bool("has_desired_release", false),
			attribute.String("reason", "blocked_by_policies"),
		)
		if planning != nil {
			planning.MakeDecision("No deployable version found", trace.DecisionRejected)
		}
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

func (p *Planner) Scheduler() *ReconciliationScheduler {
	return p.scheduler
}
