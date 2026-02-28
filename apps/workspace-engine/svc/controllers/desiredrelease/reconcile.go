package desiredrelease

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/policymatch"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

// Reconcile computes the desired release for a release target and persists it.
// All data access goes through the getter/setter interfaces so the function is
// fully testable with mocks.
func Reconcile(ctx context.Context, getter Getter, setter Setter, rt *ReleaseTarget) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "desiredrelease.Reconcile")
	defer span.End()

	scope, err := getter.GetReleaseTargetScope(ctx, rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get release target scope failed")
		return nil, fmt.Errorf("get release target scope: %w", err)
	}

	versions, err := getter.GetCandidateVersions(ctx, rt.DeploymentID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get versions failed")
		return nil, fmt.Errorf("get candidate versions: %w", err)
	}

	span.SetAttributes(attribute.Int("candidate_versions.count", len(versions)))
	if len(versions) == 0 {
		span.AddEvent("no candidate versions")
		return &ReconcileResult{}, nil
	}

	allPolicies, err := getter.GetPolicies(ctx, rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get policies failed")
		return nil, fmt.Errorf("get policies: %w", err)
	}

	target := &policymatch.Target{
		Environment: scope.Environment,
		Deployment:  scope.Deployment,
		Resource:    scope.Resource,
	}
	policies := policymatch.Filter(ctx, allPolicies, target)
	span.SetAttributes(
		attribute.Int("policies.total", len(allPolicies)),
		attribute.Int("policies.applicable", len(policies)),
	)

	oapiRT := &oapi.ReleaseTarget{
		DeploymentId:  rt.DeploymentID.String(),
		EnvironmentId: rt.EnvironmentID.String(),
		ResourceId:    rt.ResourceID.String(),
	}
	evalGetter := &policyevalAdapter{getter: getter, rt: rt}
	evals := policyeval.CollectEvaluators(ctx, evalGetter, oapiRT, policies)
	span.SetAttributes(attribute.Int("evaluators.count", len(evals)))

	version, nextTime := policyeval.FindDeployableVersion(ctx, evalGetter, oapiRT, versions, evals, *scope)
	if version == nil {
		span.AddEvent("no deployable version found")
		span.SetAttributes(attribute.String("reason", "blocked_by_policies"))
		if nextTime != nil {
			span.SetAttributes(attribute.String("next_reconcile_at", nextTime.Format(time.RFC3339)))
		}
		return &ReconcileResult{NextReconcileAt: nextTime}, nil
	}

	span.SetAttributes(
		attribute.String("deployable_version.id", version.Id),
		attribute.String("deployable_version.tag", version.Tag),
	)

	release := buildRelease(rt, version)

	if err := setter.SetDesiredRelease(ctx, rt, release); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "set desired release failed")
		return nil, fmt.Errorf("set desired release: %w", err)
	}

	span.SetAttributes(
		attribute.String("release.id", release.ID()),
		attribute.Bool("has_desired_release", true),
	)
	span.SetStatus(codes.Ok, "reconcile completed")
	return &ReconcileResult{}, nil
}
