package rollback

import (
	"context"
	"slices"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("RollbackAction")

type RollbackAction struct {
	store       *store.Store
	dispatcher  *jobs.Dispatcher
	reconcileFn func(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error
}

func NewRollbackAction(store *store.Store, dispatcher *jobs.Dispatcher, reconcileFn func(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error) *RollbackAction {
	return &RollbackAction{
		store:       store,
		dispatcher:  dispatcher,
		reconcileFn: reconcileFn,
	}
}

func (r *RollbackAction) Name() string {
	return "rollback"
}

func (r *RollbackAction) Execute(
	ctx context.Context,
	trigger action.ActionTrigger,
	actx action.ActionContext,
) error {
	ctx, span := tracer.Start(ctx, "RollbackAction.Execute")
	defer span.End()

	span.SetAttributes(
		attribute.String("trigger", string(trigger)),
		attribute.String("release.id", actx.Release.ID()),
		attribute.String("job.id", actx.Job.Id),
		attribute.String("job.status", string(actx.Job.Status)),
	)

	if !r.shouldRollback(actx.Policies, actx.Job.Status) {
		span.SetAttributes(attribute.Bool("rollback_applicable", false))
		span.SetStatus(codes.Ok, "no applicable rollback policy")
		return nil
	}

	span.SetAttributes(attribute.Bool("rollback_applicable", true))

	rollbackRecord := oapi.ReleaseRollback{
		ReleaseId:    actx.Release.ID(),
		RolledBackAt: time.Now(),
	}

	if err := r.store.ReleaseRollbacks.Upsert(ctx, &rollbackRecord); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create release rollback")
		return err
	}

	return r.reconcileFn(ctx, &actx.Release.ReleaseTarget)
}

func (r *RollbackAction) shouldRollback(policies []*oapi.Policy, jobStatus oapi.JobStatus) bool {
	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			if rule.Rollback == nil {
				continue
			}

			if rule.Rollback.OnJobStatuses != nil &&
				slices.Contains(*rule.Rollback.OnJobStatuses, jobStatus) {
				return true
			}
		}
	}

	return false
}
