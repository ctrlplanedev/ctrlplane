package desiredrelease

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	celLang "workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"

	"github.com/charmbracelet/log"
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

func (r *reconciler) filterByTargetSelector() {
	if len(r.versions) == 0 {
		return
	}

	rt := selector.NewResolvedReleaseTarget(r.scope.Environment, r.scope.Deployment, r.scope.Resource)
	celCtx := rt.CelContext()

	filtered := make([]*oapi.DeploymentVersion, 0, len(r.versions))
	for _, v := range r.versions {
		if v.Selector == nil {
			filtered = append(filtered, v)
			continue
		}

		program, err := celLang.CompileProgram(*v.Selector)
		if err != nil {
			log.Warn("selector compile failed, including version", "version", v.Id, "error", err)
			filtered = append(filtered, v)
			continue
		}

		matches, err := celutil.EvalBool(program, celCtx)
		if err != nil {
			log.Warn("selector eval failed, including version", "version", v.Id, "error", err)
			filtered = append(filtered, v)
			continue
		}

		if matches {
			filtered = append(filtered, v)
		}
	}

	r.versions = filtered
}

func (r *reconciler) loadInput(ctx context.Context) (err error) {
	r.scope, err = r.getter.GetReleaseTargetScope(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get release target scope: %w", err)
	}

	r.versions, err = r.getter.GetCandidateVersions(ctx, r.rt.DeploymentID)
	if err != nil {
		return fmt.Errorf("get candidate versions: %w", err)
	}

	r.filterByTargetSelector()

	r.policies, err = r.getter.GetPoliciesForReleaseTarget(ctx, r.rt.ToOAPI())
	if err != nil {
		return fmt.Errorf("get policies: %w", err)
	}

	return nil
}

// findDeployableVersion evaluates policy rules against candidate versions
// (newest-first) and sets r.version to the first passing version. Returns
// the earliest NextEvaluationTime when all versions are blocked.
func (r *reconciler) findDeployableVersion(ctx context.Context) *time.Time {
	if len(r.versions) == 0 {
		return nil
	}

	oapiRT := r.rt.ToOAPI()
	evals := policyeval.CollectEvaluators(ctx, r.getter, oapiRT, r.policies)

	result, err := policyeval.FindDeployableVersion(
		ctx,
		r.getter,
		oapiRT,
		r.versions,
		evals,
		*r.scope,
	)
	if err != nil {
		log.Error("find deployable version", "error", err)
		return nil
	}

	r.version = result.Version

	return result.NextTime
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

func (r *reconciler) persistNoDesiredRelease(ctx context.Context) error {
	return r.setter.SetDesiredRelease(ctx, r.rt, nil)
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
func Reconcile(
	ctx context.Context,
	workspaceID string,
	getter Getter,
	setter Setter,
	rt *ReleaseTarget,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "desiredrelease.Reconcile")
	defer span.End()

	log.Info("reconcile", "workspaceID", workspaceID, "rt", rt)

	workspaceIDUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	r := &reconciler{workspaceID: workspaceIDUUID, getter: getter, setter: setter, rt: rt}
	r.rt.WorkspaceID = r.workspaceID

	if err := r.loadInput(ctx); err != nil {
		return nil, recordErr(span, "load input", err)
	}

	log.Info("find deployable version", "versions", len(r.versions))

	nextTime := r.findDeployableVersion(ctx)
	if r.version == nil {
		if err := r.persistNoDesiredRelease(ctx); err != nil {
			return nil, recordErr(span, "persist no desired release", err)
		}
		return &ReconcileResult{NextReconcileAt: nextTime}, nil
	}

	if err := r.resolveVariables(ctx); err != nil {
		return nil, recordErr(span, "resolve variables", err)
	}

	release, err := r.persistRelease(ctx)
	if err != nil {
		return nil, recordErr(span, "persist release", err)
	}

	if err := r.setter.EnqueueJobEligibility(ctx, r.workspaceID.String(), r.rt); err != nil {
		return nil, recordErr(span, "enqueue job eligibility", err)
	}

	span.SetStatus(codes.Ok, "reconcile completed: release="+release.Id.String())
	return &ReconcileResult{NextReconcileAt: nextTime}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
