package deployment

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/relationships/compute"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/releasemanager/trace"

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

func computeRelations(ctx context.Context, ws *workspace.Workspace, deployment *oapi.Deployment) []*relationships.EntityRelation {
	rules := make([]*oapi.RelationshipRule, 0)
	for _, rule := range ws.RelationshipRules().Items() {
		rules = append(rules, rule)
	}
	entity := relationships.NewDeploymentEntity(deployment)
	return compute.FindRelationsForEntity(ctx, rules, entity, ws.Relations().GetRelatableEntities(ctx))
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

	relations := computeRelations(ctx, ws, deployment)
	for _, relation := range relations {
		ws.Relations().Upsert(ctx, relation)
	}

	releaseTargets, err := makeReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}

		if deployment.JobAgentId != nil && *deployment.JobAgentId != "" {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerDeploymentCreated))

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

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	oldRelations := ws.Relations().ForEntity(relationships.NewDeploymentEntity(deployment))

	// Upsert the new deployment
	if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
		return err
	}

	newRelations := computeRelations(ctx, ws, deployment)
	removedRelations := compute.FindRemovedRelations(ctx, oldRelations, newRelations)

	for _, removedRelation := range removedRelations {
		ws.Relations().Remove(removedRelation.Key())
	}

	for _, relation := range newRelations {
		ws.Relations().Upsert(ctx, relation)
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
			ws.ReleaseManager().ReconcileTarget(ctx, addedReleaseTarget,
				releasemanager.WithTrigger(trace.TriggerDeploymentUpdated))
		}
	}

	jobsToRetrigger := getJobsToRetrigger(ws, deployment)
	if len(jobsToRetrigger) > 0 {
		retriggerInvalidJobAgentJobs(ctx, ws, jobsToRetrigger)
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

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	entity := relationships.NewDeploymentEntity(deployment)
	oldRelations := ws.Relations().ForEntity(entity)
	for _, oldRelation := range oldRelations {
		ws.Relations().Remove(oldRelation.Key())
	}

	ws.Deployments().Remove(ctx, deployment.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}

type jobWithReleaseTarget struct {
	Job           *oapi.Job
	ReleaseTarget *oapi.ReleaseTarget
}

func getAllJobsWithReleaseTarget(ws *workspace.Workspace, deployment *oapi.Deployment) []*jobWithReleaseTarget {
	allJobs := ws.Jobs().Items()
	jobsSlice := make([]*jobWithReleaseTarget, 0)
	for _, job := range allJobs {
		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		if release.ReleaseTarget.DeploymentId != deployment.Id {
			continue
		}

		jobsSlice = append(jobsSlice, &jobWithReleaseTarget{Job: job, ReleaseTarget: &release.ReleaseTarget})
	}
	sort.Slice(jobsSlice, func(i, j int) bool {
		return jobsSlice[i].Job.CreatedAt.Before(jobsSlice[j].Job.CreatedAt)
	})
	return jobsSlice
}

func getJobsToRetrigger(ws *workspace.Workspace, deployment *oapi.Deployment) []*oapi.Job {
	latestJobs := make(map[string]*oapi.Job)
	jobsSlice := getAllJobsWithReleaseTarget(ws, deployment)

	for _, jobWithReleaseTarget := range jobsSlice {
		latestJobs[jobWithReleaseTarget.ReleaseTarget.Key()] = jobWithReleaseTarget.Job
	}

	jobsToRetrigger := make([]*oapi.Job, 0)
	for _, job := range latestJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			jobsToRetrigger = append(jobsToRetrigger, job)
		}
	}
	return jobsToRetrigger
}

// retriggerInvalidJobAgentJobs creates new Pending jobs for all releases that currently have InvalidJobAgent jobs
// Note: This is an explicit retrigger operation for configuration fixes, so we bypass normal
// eligibility checks (like retry limits). The old InvalidJobAgent job remains for history.
func retriggerInvalidJobAgentJobs(ctx context.Context, ws *workspace.Workspace, jobsToRetrigger []*oapi.Job) {
	// Create job factory and dispatcher
	jobFactory := jobs.NewFactory(ws.Store())
	jobDispatcher := jobs.NewDispatcher(ws.Store())

	for _, job := range jobsToRetrigger {
		// Get the release for this job
		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		// Create a new job for this release (bypassing eligibility checks for explicit retrigger)
		newJob, err := jobFactory.CreateJobForRelease(ctx, release, nil)
		if err != nil {
			log.Error("failed to create job for release during retrigger",
				"releaseId", release.ID(),
				"deploymentId", release.ReleaseTarget.DeploymentId,
				"error", err.Error())
			continue
		}

		// Upsert the new job
		ws.Jobs().Upsert(ctx, newJob)

		log.Info("created new job for previously invalid job agent",
			"newJobId", newJob.Id,
			"originalJobId", job.Id,
			"releaseId", release.ID(),
			"deploymentId", release.ReleaseTarget.DeploymentId,
			"status", newJob.Status)

		// Dispatch the job asynchronously if it's not InvalidJobAgent
		if newJob.Status != oapi.JobStatusInvalidJobAgent {
			go func(jobToDispatch *oapi.Job) {
				if err := jobDispatcher.DispatchJob(ctx, jobToDispatch); err != nil && !errors.Is(err, jobs.ErrUnsupportedJobAgent) {
					log.Error("error dispatching retriggered job to integration",
						"jobId", jobToDispatch.Id,
						"error", err.Error())
					jobToDispatch.Status = oapi.JobStatusInvalidIntegration
					jobToDispatch.UpdatedAt = time.Now()
					ws.Jobs().Upsert(ctx, jobToDispatch)
				}
			}(newJob)
		}
	}
}
