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

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

// reconciler holds the state for a single reconciliation pass. Each phase
// (load → evaluate → resolve → persist) is a method that reads from and
// writes to the struct, keeping Reconcile itself a clean pipeline.
type reconciler struct {
	workspaceID uuid.UUID

	getter Getter
	setter Setter
	rt     *ReleaseTarget

	scope    *evaluator.EvaluatorScope
	versions []*oapi.DeploymentVersion
	policies []*oapi.Policy
	version  *oapi.DeploymentVersion
	vars     map[string]oapi.LiteralValue
}

func (r *reconciler) loadInput(ctx context.Context) error {
	scope, err := r.getter.GetReleaseTargetScope(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get release target scope: %w", err)
	}
	r.scope = scope

	versions, err := r.getter.GetCandidateVersions(ctx, r.rt.DeploymentID)
	if err != nil {
		return fmt.Errorf("get candidate versions: %w", err)
	}
	r.versions = versions

	policies, err := r.getter.GetPoliciesForReleaseTarget(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get policies: %w", err)
	}
	r.policies = policymatch.Filter(ctx, policies, r.scope.ToTarget())

	return nil
}

// findDeployableVersion evaluates policy rules against candidate versions
// (newest-first) and sets r.version to the first passing version. Returns
// the earliest NextEvaluationTime when all versions are blocked.
func (r *reconciler) findDeployableVersion(ctx context.Context) *time.Time {
	oapiRT := r.rt.ToOAPI()
	evals := policyeval.CollectEvaluators(ctx, r.getter, oapiRT, r.policies)
	var nextTime *time.Time
	r.version, nextTime = policyeval.FindDeployableVersion(ctx, r.getter, oapiRT, r.versions, evals, *r.scope)
	return nextTime
}

func (r *reconciler) resolveVariables(ctx context.Context) error {
	varScope := &variableresolver.Scope{
		Resource:    r.scope.Resource,
		Deployment:  r.scope.Deployment,
		Environment: r.scope.Environment,
	}
	vars, err := variableresolver.Resolve(
		ctx, r.getter, varScope,
		r.rt.DeploymentID.String(), r.rt.ResourceID.String(),
	)
	if err != nil {
		return err
	}
	r.vars = vars
	return nil
}

func (r *reconciler) persistRelease(ctx context.Context) (*oapi.Release, error) {
	release := buildRelease(r.rt, r.version, r.vars)
	if err := r.setter.SetDesiredRelease(ctx, r.rt, release); err != nil {
		return nil, err
	}
	return release, nil
}

// Reconcile computes the desired release for a release target and persists it.
// All data access goes through the getter/setter interfaces so the function is
// fully testable with mocks.
func Reconcile(ctx context.Context, workspaceID string, getter Getter, setter Setter, rt *ReleaseTarget) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "desiredrelease.Reconcile")
	defer span.End()

	r := &reconciler{workspaceID: uuid.MustParse(workspaceID), getter: getter, setter: setter, rt: rt}
	r.rt.WorkspaceID = r.workspaceID

	if err := r.loadInput(ctx); err != nil {
		return nil, recordErr(span, "load input", err)
	}
	if len(r.versions) == 0 {
		return &ReconcileResult{}, nil
	}

	nextTime := r.findDeployableVersion(ctx)
	if r.version == nil {
		return &ReconcileResult{NextReconcileAt: nextTime}, nil
	}

	if err := r.resolveVariables(ctx); err != nil {
		return nil, recordErr(span, "resolve variables", err)
	}

	release, err := r.persistRelease(ctx)
	if err != nil {
		return nil, recordErr(span, "persist release", err)
	}

	span.SetStatus(codes.Ok, "reconcile completed: release="+release.Id.String())
	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
