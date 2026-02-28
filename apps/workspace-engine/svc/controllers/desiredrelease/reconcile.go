package desiredrelease

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/policymatch"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
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
		return nil, recordErr(span, "get release target scope", err)
	}

	versions, err := getter.GetCandidateVersions(ctx, rt.DeploymentID)
	if err != nil {
		return nil, recordErr(span, "get candidate versions", err)
	}
	if len(versions) == 0 {
		span.AddEvent("no candidate versions")
		return &ReconcileResult{}, nil
	}
	span.SetAttributes(attribute.Int("candidate_versions.count", len(versions)))

	version, nextTime, err := findDeployableVersion(ctx, span, getter, rt, scope, versions)
	if err != nil {
		return nil, recordErr(span, "find deployable version", err)
	}
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

	resolvedVars, err := resolveVariables(ctx, getter, rt, scope)
	if err != nil {
		return nil, recordErr(span, "resolve variables", err)
	}
	span.SetAttributes(attribute.Int("resolved_variables.count", len(resolvedVars)))

	release := buildRelease(rt, version, resolvedVars)
	if err := setter.SetDesiredRelease(ctx, rt, release); err != nil {
		return nil, recordErr(span, "set desired release", err)
	}

	span.SetAttributes(
		attribute.String("release.id", release.ID()),
		attribute.Bool("has_desired_release", true),
	)
	span.SetStatus(codes.Ok, "reconcile completed")
	return &ReconcileResult{}, nil
}

// findDeployableVersion filters policies, builds evaluators, and returns the
// first version that passes all policy checks. Returns (nil, nextTime, nil)
// when every version is blocked.
func findDeployableVersion(
	ctx context.Context,
	span trace.Span,
	getter Getter,
	rt *ReleaseTarget,
	scope *evaluator.EvaluatorScope,
	versions []*oapi.DeploymentVersion,
) (*oapi.DeploymentVersion, *time.Time, error) {
	allPolicies, err := getter.GetPolicies(ctx, rt)
	if err != nil {
		return nil, nil, fmt.Errorf("get policies: %w", err)
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

	oapiRT := rt.ToOAPI()
	evalGetter := &policyevalAdapter{getter: getter, rt: rt}
	evals := policyeval.CollectEvaluators(ctx, evalGetter, oapiRT, policies)
	span.SetAttributes(attribute.Int("evaluators.count", len(evals)))

	version, nextTime := policyeval.FindDeployableVersion(ctx, evalGetter, oapiRT, versions, evals, *scope)
	return version, nextTime, nil
}

// resolveVariables computes the final variable set for the release target
// using the three-tier priority: resource var → deployment var value → default.
func resolveVariables(
	ctx context.Context,
	getter Getter,
	rt *ReleaseTarget,
	scope *evaluator.EvaluatorScope,
) (map[string]oapi.LiteralValue, error) {
	varScope := &variableresolver.Scope{
		Resource:    scope.Resource,
		Deployment:  scope.Deployment,
		Environment: scope.Environment,
	}
	varGetter := &variableResolverAdapter{getter: getter}
	return variableresolver.Resolve(
		ctx, varGetter, varScope,
		rt.DeploymentID.String(), rt.ResourceID.String(),
	)
}

// recordErr logs the error on the span, sets the span status, and returns a
// wrapped error — collapsing a 3-line pattern into a single call.
func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
