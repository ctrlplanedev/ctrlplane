package jobs

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

func isStringUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func getInternalReleaseID(ws *workspace.Workspace, jobUpdateEvent *oapi.JobUpdateEvent) string {
	eventReleaseID := jobUpdateEvent.Job.ReleaseId
	if eventReleaseID == "" {
		return ""
	}

	if !isStringUUID(eventReleaseID) {
		return eventReleaseID
	}

	for _, release := range ws.Releases().Items() {
		if release.UUID().String() == eventReleaseID {
			return release.ID()
		}
	}

	return ""
}

func HandleJobUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var jobUpdateEvent *oapi.JobUpdateEvent
	if err := json.Unmarshal(event.Data, &jobUpdateEvent); err != nil {
		return err
	}

	internalReleaseID := getInternalReleaseID(ws, jobUpdateEvent)
	jobUpdateEvent.Job.ReleaseId = internalReleaseID

	job, exists := getJob(ws, jobUpdateEvent)
	if !exists {
		return nil
	}

	// Capture the previous status before updating
	previousStatus := job.Status

	// Preserve trace token from stored job if not provided in event
	// The trace token is generated during job execution and must be preserved
	// for verification tracing to work
	if job.TraceToken != nil && jobUpdateEvent.Job.TraceToken == nil {
		jobUpdateEvent.Job.TraceToken = job.TraceToken
	}

	// No fields specified - replace entire job
	if jobUpdateEvent.FieldsToUpdate == nil || len(*jobUpdateEvent.FieldsToUpdate) == 0 {
		ws.Jobs().Upsert(ctx, &jobUpdateEvent.Job)
		invalidateCacheForJob(ws, &jobUpdateEvent.Job)
		// Trigger actions on status change
		triggerActionsOnStatusChange(ctx, ws, &jobUpdateEvent.Job, previousStatus)
		return nil
	}

	file := make([]string, len(*jobUpdateEvent.FieldsToUpdate))
	for i, field := range *jobUpdateEvent.FieldsToUpdate {
		file[i] = string(field)
	}
	mergedJob, err := handler.MergeFields(job, &jobUpdateEvent.Job, file)
	if err != nil {
		return err
	}

	ws.Jobs().Upsert(ctx, mergedJob)
	invalidateCacheForJob(ws, mergedJob)

	// Trigger actions on status change
	triggerActionsOnStatusChange(ctx, ws, mergedJob, previousStatus)

	go func() {
		if err := MaybeAddCommitStatusFromJob(ws, mergedJob); err != nil {
			log.Error("error adding commit status", "error", err.Error())
		}
	}()

	return nil
}

// triggerActionsOnStatusChange notifies the action orchestrator of job status changes.
// This enables policy actions like verification to run when jobs complete.
func triggerActionsOnStatusChange(ctx context.Context, ws *workspace.Workspace, job *oapi.Job, previousStatus oapi.JobStatus) {
	// Only trigger if status actually changed
	if job.Status == previousStatus {
		return
	}

	err := ws.
		ActionOrchestrator().
		OnJobStatusChange(ctx, job, previousStatus)
	if err != nil {
		log.Error("error triggering actions on status change", "job_id", job.Id, "from", previousStatus, "to", job.Status, "error", err.Error())
	}
}

// invalidateCacheForJob invalidates the release target state cache for the job's release target.
// This ensures that subsequent calls to GetReleaseTargetState return fresh data.
func invalidateCacheForJob(ws *workspace.Workspace, job *oapi.Job) {
	// Get the release for this job
	release, exists := ws.Releases().Get(job.ReleaseId)
	if !exists {
		return
	}

	// Invalidate the cache for this release target
	ws.ReleaseManager().InvalidateReleaseTargetState(&release.ReleaseTarget)
}

func getJob(ws *workspace.Workspace, job *oapi.JobUpdateEvent) (*oapi.Job, bool) {
	if job.Id != nil && *job.Id != "" {
		if existing, exists := ws.Jobs().Get(*job.Id); exists {
			return existing, true
		}
	}

	if job.AgentId == nil || *job.AgentId == "" {
		return nil, false
	}

	if job.ExternalId == nil || *job.ExternalId == "" {
		return nil, false
	}

	// Try finding by job agent ID + external ID
	return ws.Jobs().Get(*job.Id)
}
