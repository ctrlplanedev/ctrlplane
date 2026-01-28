package rollback

import (
	"context"
	"slices"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("RollbackAction")

type RollbackAction struct {
	store            *store.Store
	jobAgentRegistry *jobagents.Registry
}

func NewRollbackAction(store *store.Store, verificationManager *verification.Manager) *RollbackAction {
	return &RollbackAction{
		store:            store,
		jobAgentRegistry: jobagents.NewRegistry(store, verificationManager),
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

	currentRelease, lastSuccessfulJob, err := r.store.ReleaseTargets.GetCurrentRelease(ctx, &actx.Release.ReleaseTarget)
	if err != nil {
		span.AddEvent("No previous release to roll back to")
		span.SetStatus(codes.Ok, "no previous release available")
		return nil
	}

	if currentRelease.ID() == actx.Release.ID() {
		span.AddEvent("Current release is the same as failed release, no rollback needed")
		span.SetStatus(codes.Ok, "already on current release")
		return nil
	}

	span.SetAttributes(
		attribute.String("rollback_to_release.id", currentRelease.ID()),
		attribute.String("rollback_to_version.id", currentRelease.Version.Id),
		attribute.String("rollback_to_version.tag", currentRelease.Version.Tag),
	)

	now := time.Now()
	newJob := oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      lastSuccessfulJob.ReleaseId,
		JobAgentId:     lastSuccessfulJob.JobAgentId,
		JobAgentConfig: lastSuccessfulJob.JobAgentConfig,
		Status:         oapi.JobStatusPending,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	r.store.Jobs.Upsert(ctx, &newJob)

	if err := r.jobAgentRegistry.Dispatch(ctx, &newJob); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "rollback execution failed")
		return err
	}

	span.SetStatus(codes.Ok, "rollback executed successfully")
	return nil
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
