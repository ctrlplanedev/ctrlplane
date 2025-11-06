package deployment

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"

	"github.com/charmbracelet/log"
)

func makeReleaseTargets(ctx context.Context, ws *workspace.Workspace, deployment *oapi.Deployment) ([]*oapi.ReleaseTarget, error) {
	environments := ws.Systems().Environments(deployment.SystemId)
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, environment := range environments {
		resources, err := ws.Environments().Resources(ctx, environment.Id)
		if err != nil {
			return nil, err
		}
		for _, resource := range resources {
			isMatch, err := selector.Match(ctx, deployment.ResourceSelector, resource)
			if err != nil {
				return nil, err
			}
			if isMatch {
				releaseTargets = append(releaseTargets, &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				})
			}
		}
	}
	return releaseTargets, nil
}

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

	releaseTargets, err := makeReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}

		if deployment.JobAgentId != nil && *deployment.JobAgentId != "" {
			ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
		}
	}

	return nil
}

func getRemovedReleaseTargets(oldReleaseTargets []*oapi.ReleaseTarget, newReleaseTargets []*oapi.ReleaseTarget) []*oapi.ReleaseTarget {
	removedReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, oldReleaseTarget := range oldReleaseTargets {
		found := false
		for _, newReleaseTarget := range newReleaseTargets {
			if oldReleaseTarget.Key() == newReleaseTarget.Key() {
				found = true
				break
			}
		}
		if !found {
			removedReleaseTargets = append(removedReleaseTargets, oldReleaseTarget)
		}
	}
	return removedReleaseTargets
}

func getAddedReleaseTargets(oldReleaseTargets []*oapi.ReleaseTarget, newReleaseTargets []*oapi.ReleaseTarget) []*oapi.ReleaseTarget {
	addedReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, newReleaseTarget := range newReleaseTargets {
		found := false
		for _, oldReleaseTarget := range oldReleaseTargets {
			if oldReleaseTarget.Key() == newReleaseTarget.Key() {
				found = true
				break
			}
		}
		if !found {
			addedReleaseTargets = append(addedReleaseTargets, newReleaseTarget)
		}
	}
	return addedReleaseTargets
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

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	releaseTargets, err := makeReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
	addedReleaseTargets := getAddedReleaseTargets(oldReleaseTargets, releaseTargets)

	for _, removedReleaseTarget := range removedReleaseTargets {
		ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
	}
	for _, addedReleaseTarget := range addedReleaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, addedReleaseTarget)
		if err != nil {
			return err
		}

		if deployment.JobAgentId != nil && *deployment.JobAgentId != "" {
			ws.ReleaseManager().ReconcileTarget(ctx, addedReleaseTarget, false)
		}
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

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

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
// Note: This is an explicit retrigger operation for configuration fixes, so we bypass normal
// eligibility checks (like skipdeployed). The old InvalidJobAgent job remains for history.
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

		// Create a new job for this release (bypassing eligibility checks for explicit retrigger)
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
