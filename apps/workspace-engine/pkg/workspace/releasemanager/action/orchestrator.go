package action

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/releasemanager/action")

// Orchestrator manages and executes policy actions
type Orchestrator struct {
	store   *store.Store
	actions []PolicyAction
}

// NewOrchestrator creates a new action orchestrator
func NewOrchestrator(store *store.Store) *Orchestrator {
	return &Orchestrator{
		store:   store,
		actions: make([]PolicyAction, 0),
	}
}

// RegisterAction registers a policy action with the orchestrator
func (o *Orchestrator) RegisterAction(action PolicyAction) {
	o.actions = append(o.actions, action)
	log.Debug("Registered policy action", "action", action.Name())
}

// OnJobStatusChange is called when a job's status changes
// This should be called BEFORE the job status is persisted to prevent race conditions
func (o *Orchestrator) OnJobStatusChange(
	ctx context.Context,
	job *oapi.Job,
	previousStatus oapi.JobStatus,
) error {
	ctx, span := tracer.Start(ctx, "ActionOrchestrator.OnJobStatusChange")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("job.status", string(job.Status)),
		attribute.String("previous_status", string(previousStatus)))

	// Determine trigger based on status change
	trigger := determineTrigger(job.Status, previousStatus)
	if trigger == "" {
		span.SetAttributes(attribute.Bool("trigger_found", false))
		return nil // No trigger for this status change
	}

	span.SetAttributes(
		attribute.Bool("trigger_found", true),
		attribute.String("trigger", string(trigger)))

	// Get release and policies
	release, ok := o.store.Releases.Get(job.ReleaseId)
	if !ok {
		span.SetStatus(codes.Error, "release not found")
		return nil // No release found
	}

	span.SetAttributes(attribute.String("release.id", release.ID()))

	policies, err := o.store.ReleaseTargets.GetPolicies(ctx, &release.ReleaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get policies")
		return nil // Don't fail job update on policy lookup failure
	}

	if len(policies) == 0 {
		span.SetAttributes(attribute.Int("policy_count", 0))
		return nil // No policies apply
	}

	span.SetAttributes(attribute.Int("policy_count", len(policies)))

	// Build action context with pre-fetched policies for efficiency and consistency
	// Policies passed here so actions don't redundantly fetch from store
	actx := ActionContext{
		Job:      job,
		Release:  release,
		Policies: policies,
	}

	// Execute all actions synchronously (actions fail fast if they don't apply)
	for _, action := range o.actions {
		span.AddEvent("Executing action")
		span.SetAttributes(attribute.String("action.name", action.Name()))

		if err := action.Execute(ctx, trigger, actx); err != nil {
			// Log error but don't fail the job status update
			span.RecordError(err)
			log.Error("Policy action failed",
				"action", action.Name(),
				"job_id", job.Id,
				"release_id", release.ID(),
				"error", err)
			// Continue with other actions
		}
	}

	span.SetStatus(codes.Ok, "actions completed")
	return nil
}

// determineTrigger determines which trigger to fire based on job status changes
func determineTrigger(
	currentStatus oapi.JobStatus,
	previousStatus oapi.JobStatus,
) ActionTrigger {
	// Job just created
	if previousStatus == "" && currentStatus == oapi.JobStatusPending {
		return TriggerJobCreated
	}

	// Job started
	if previousStatus != oapi.JobStatusInProgress && currentStatus == oapi.JobStatusInProgress {
		return TriggerJobStarted
	}

	// Job succeeded
	if currentStatus == oapi.JobStatusSuccessful {
		return TriggerJobSuccess
	}

	// Job failed
	if currentStatus == oapi.JobStatusFailure {
		return TriggerJobFailure
	}

	return ""
}
