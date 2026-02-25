package desiredrelease

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"

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

	policies, err := getter.GetPolicies(ctx, rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get policies failed")
		return nil, fmt.Errorf("get policies: %w", err)
	}

	evals := CollectEvaluators(policies)
	span.SetAttributes(attribute.Int("evaluators.count", len(evals)))

	version, nextTime := FindDeployableVersion(ctx, versions, evals, *scope)
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

func buildRelease(rt *ReleaseTarget, version *oapi.DeploymentVersion) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *version,
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}
