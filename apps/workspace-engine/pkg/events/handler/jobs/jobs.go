package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/jobdispatch"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// JobCreatedEventData contains the data for a job.created event.
type JobCreatedEventData struct {
	Job *oapi.Job `json:"job"`
}

// HandleJobCreated handles the job.created event.
// This handler performs write operations for job creation:
// - Cancels outdated jobs for the release target
// - Upserts the new job
// - Dispatches the job if it's not InvalidJobAgent
// Note: The release is already persisted before this event is sent
func HandleJobCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var data JobCreatedEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to unmarshal job.created event: %w", err)
	}

	job := data.Job

	// Get the release for this job to cancel outdated jobs
	release, exists := ws.Store().Releases.Get(job.ReleaseId)
	if !exists {
		return fmt.Errorf("release %s not found for job %s", job.ReleaseId, job.Id)
	}

	// Step 1: Cancel outdated jobs for this release target
	// Cancel any pending jobs for this release target (outdated versions)
	cancelOutdatedJobs(ctx, ws, release)

	// Step 2: Upsert the new job
	ws.Store().Jobs.Upsert(ctx, job)

	// Skip dispatch in replay mode
	if ws.Store().IsReplay() {
		log.Info("Skipping job dispatch in replay mode", "job.id", job.Id)
		return nil
	}

	// Step 3: Dispatch job to integration (ASYNC)
	// Skip dispatch if job already has InvalidJobAgent status
	if job.Status != oapi.InvalidJobAgent {
		go func() {
			if err := dispatchJob(ctx, ws, job); err != nil && !errors.Is(err, jobs.ErrUnsupportedJobAgent) {
				log.Error("error dispatching job to integration", "error", err.Error())
				job.Status = oapi.InvalidIntegration
				job.UpdatedAt = time.Now()
				ws.Store().Jobs.Upsert(ctx, job)
			}
		}()
	}

	return nil
}

// cancelOutdatedJobs cancels jobs for outdated releases.
func cancelOutdatedJobs(ctx context.Context, ws *workspace.Workspace, desiredRelease *oapi.Release) {
	jobs := ws.Store().Jobs.GetJobsForReleaseTarget(&desiredRelease.ReleaseTarget)

	for _, job := range jobs {
		if job.Status == oapi.Pending {
			job.Status = oapi.Cancelled
			job.UpdatedAt = time.Now()
			ws.Store().Jobs.Upsert(ctx, job)
		}
	}
}

// dispatchJob sends a job to the configured job agent for execution.
func dispatchJob(ctx context.Context, ws *workspace.Workspace, job *oapi.Job) error {
	jobAgent, exists := ws.Store().JobAgents.Get(job.JobAgentId)
	if !exists {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	if jobAgent.Type == string(jobdispatch.JobAgentTypeGithub) {
		return jobdispatch.NewGithubDispatcher(ws.Store()).DispatchJob(ctx, job)
	}

	return jobs.ErrUnsupportedJobAgent
}

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
		return fmt.Errorf("job not found")
	}

	// No fields specified - replace entire job
	if jobUpdateEvent.FieldsToUpdate == nil || len(*jobUpdateEvent.FieldsToUpdate) == 0 {
		ws.Jobs().Upsert(ctx, &jobUpdateEvent.Job)
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

	return nil
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
	return ws.Jobs().GetByJobAgentAndExternalId(*job.AgentId, *job.ExternalId)
}
