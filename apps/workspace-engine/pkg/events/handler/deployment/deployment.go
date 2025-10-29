package deployment

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"

	"github.com/charmbracelet/log"
)

func HandleDeploymentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
		return err
	}

	return nil
}

func HandleDeploymentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	// Upsert the new deployment
	if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
		return err
	}

	// Check if this deployment now has a valid job agent configured and
	// if there are any InvalidJobAgent jobs that need to be retriggered
	if shouldRetriggerJobs(ws, deployment) {
		retriggerInvalidJobAgentJobs(ctx, ws, deployment)
	}

	return nil
}

func HandleDeploymentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	ws.Deployments().Remove(ctx, deployment.Id)

	return nil
}

// shouldRetriggerJobs checks if we should retrigger InvalidJobAgent jobs for this deployment.
// This happens when:
// 1. The deployment has a valid job agent configured
// 2. There are InvalidJobAgent jobs for releases in this deployment
func shouldRetriggerJobs(ws *workspace.Workspace, deployment *oapi.Deployment) bool {
	// Check if deployment has a valid job agent configured
	if deployment.JobAgentId == nil || *deployment.JobAgentId == "" {
		return false
	}

	// Check if the job agent exists
	if _, exists := ws.JobAgents().Get(*deployment.JobAgentId); !exists {
		return false
	}

	// Check if there are any InvalidJobAgent jobs for this deployment
	for _, job := range ws.Jobs().Items() {
		if job.Status != oapi.InvalidJobAgent {
			continue
		}

		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		if release.ReleaseTarget.DeploymentId == deployment.Id {
			return true
		}
	}

	return false
}

// retriggerInvalidJobAgentJobs creates new Pending jobs for all releases that currently have InvalidJobAgent jobs
func retriggerInvalidJobAgentJobs(ctx context.Context, ws *workspace.Workspace, deployment *oapi.Deployment) {
	// Create job factory and dispatcher
	jobFactory := jobs.NewFactory(ws.Store())
	jobDispatcher := jobs.NewDispatcher(ws.Store())

	// Find all InvalidJobAgent jobs for this deployment
	for _, job := range ws.Jobs().Items() {
		// Skip if job is not InvalidJobAgent status
		if job.Status != oapi.InvalidJobAgent {
			continue
		}

		// Get the release for this job
		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		// Check if this release belongs to the updated deployment
		if release.ReleaseTarget.DeploymentId != deployment.Id {
			continue
		}

		// Create a new job for this release
		newJob, err := jobFactory.CreateJobForRelease(ctx, release)
		if err != nil {
			log.Error("failed to create job for release during retrigger",
				"releaseId", release.ID(),
				"deploymentId", deployment.Id,
				"error", err.Error())
			continue
		}

		// Upsert the new job
		ws.Jobs().Upsert(ctx, newJob)

		log.Info("created new job for previously invalid job agent",
			"newJobId", newJob.Id,
			"originalJobId", job.Id,
			"releaseId", release.ID(),
			"deploymentId", deployment.Id,
			"status", newJob.Status)

		// Dispatch the job asynchronously if it's not InvalidJobAgent
		if newJob.Status != oapi.InvalidJobAgent {
			go func(jobToDispatch *oapi.Job) {
				if err := jobDispatcher.DispatchJob(ctx, jobToDispatch); err != nil && !errors.Is(err, jobs.ErrUnsupportedJobAgent) {
					log.Error("error dispatching retriggered job to integration",
						"jobId", jobToDispatch.Id,
						"error", err.Error())
					jobToDispatch.Status = oapi.InvalidIntegration
					jobToDispatch.UpdatedAt = time.Now()
					ws.Jobs().Upsert(ctx, jobToDispatch)
				}
			}(newJob)
		}
	}
}
