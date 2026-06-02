package desiredrelease

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

// reconciler holds the state for a single reconciliation pass. Each phase
// (load → evaluate → resolve → persist) is a method that reads from and
// writes to the struct, keeping Reconcile itself a clean pipeline.
type reconciler struct {
	workspaceID uuid.UUID

	getter         Getter
	setter         Setter
	secretResolver variableresolver.SecretResolver
	rt             *ReleaseTarget

	scope         *evaluator.EvaluatorScope
	policies      []*oapi.Policy
	version       *oapi.DeploymentVersion
	vars          map[string]oapi.LiteralValue
	sensitiveVars []string
}

func (r *reconciler) loadInput(ctx context.Context) (err error) {
	r.scope, err = r.getter.GetReleaseTargetScope(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get release target scope: %w", err)
	}

	r.policies, err = r.getter.GetPoliciesForReleaseTarget(ctx, r.rt.ToOAPI())
	if err != nil {
		return fmt.Errorf("get policies: %w", err)
	}

	return nil
}

// findDeployableVersion evaluates policy rules against candidate versions
// (newest-first, streamed) and sets r.version to the first passing version.
// Returns the earliest NextEvaluationTime when all versions are blocked.
func (r *reconciler) findDeployableVersion(ctx context.Context) *time.Time {
	oapiRT := r.rt.ToOAPI()
	evals := policyeval.CollectEvaluators(ctx, r.getter, oapiRT, r.policies)
	clauses, args := collectPushdownClauses(r.policies)

	result, err := policyeval.FindDeployableVersion(
		ctx,
		r.getter,
		oapiRT,
		r.getter.IterCandidateVersions(ctx, r.rt.DeploymentID, clauses, args),
		evals,
		*r.scope,
	)
	if err != nil {
		slog.ErrorContext(ctx, "find deployable version", "error", err)
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
	vars, sensitive, err := variableresolver.Resolve(
		ctx, r.getter, r.secretResolver, varScope,
		r.rt.DeploymentID.String(), r.rt.ResourceID.String(),
	)
	if err != nil {
		return err
	}
	r.vars = vars
	r.sensitiveVars = sensitive
	return nil
}

func (r *reconciler) persistNoDesiredRelease(ctx context.Context) error {
	return r.setter.SetDesiredRelease(ctx, r.rt, nil)
}

func (r *reconciler) persistRelease(ctx context.Context) (*oapi.Release, error) {
	release := buildRelease(r.rt, r.version, r.vars, r.sensitiveVars)
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
	secretResolver variableresolver.SecretResolver,
	rt *ReleaseTarget,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "desiredrelease.Reconcile")
	defer span.End()

	slog.InfoContext(ctx, "reconcile", "workspaceID", workspaceID, "rt", rt)

	workspaceIDUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	r := &reconciler{
		workspaceID:    workspaceIDUUID,
		getter:         getter,
		setter:         setter,
		secretResolver: secretResolver,
		rt:             rt,
	}
	r.rt.WorkspaceID = r.workspaceID

	if err := r.loadInput(ctx); err != nil {
		return nil, recordErr(span, "load input", err)
	}

	slog.InfoContext(ctx, "find deployable version")

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

// pushdownBaseParam is the next available `$N` placeholder after the four
// base parameters used by the candidate-version query (deploymentID, limit,
// afterCreatedAt, afterID).
const pushdownBaseParam = 5

// collectPushdownClauses inspects a release target's policies for
// versionselector rules and translates each into a parameterized SQL WHERE
// fragment via versionselector.TryPushDown. Rules that can't be translated
// (selectors referencing environment/resource/deployment, OR composition,
// non-string values, etc.) are silently skipped — the runtime CEL evaluator
// still runs per-version, so correctness is preserved; only the
// candidate-set narrowing is lost.
//
// Each fragment carries `$N` placeholders into the returned args slice, with
// numbering picked up from where the previous fragment left off so all
// fragments can be appended into the same query without collisions.
func collectPushdownClauses(policies []*oapi.Policy) (clauses []string, args []any) {
	for _, p := range policies {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			if rule.VersionSelector == nil {
				continue
			}
			clause, clauseArgs, ok := versionselector.TryPushDown(
				rule.VersionSelector.Selector,
				pushdownBaseParam+len(args),
			)
			if !ok {
				continue
			}
			clauses = append(clauses, clause)
			args = append(args, clauseArgs...)
		}
	}
	return clauses, args
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
