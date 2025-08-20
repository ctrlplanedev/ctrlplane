package workspace

import (
	"context"
	"errors"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/job"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type JobDispatchRequest struct {
	ReleaseTarget *rt.ReleaseTarget
	Version       *deployment.DeploymentVersion
}

type JobDispatcher struct {
	repository *WorkspaceRepository
}

func NewJobDispatcher(wsRepo *WorkspaceRepository) *JobDispatcher {
	return &JobDispatcher{repository: wsRepo}
}

func validateRequest(request JobDispatchRequest) error {
	if request.ReleaseTarget == nil {
		return errors.New("release target is required")
	}
	if request.Version == nil {
		return errors.New("version is required")
	}
	return nil
}

func (jd *JobDispatcher) createJob(ctx context.Context, request JobDispatchRequest) (*job.Job, error) {
	if err := validateRequest(request); err != nil {
		log.Error("Invalid request", "error", err)
		return nil, err
	}

	deployment := request.ReleaseTarget.Deployment
	jobAgentID := deployment.GetJobAgentID()
	if jobAgentID == nil || *jobAgentID == "" {
		log.Info("No job agent configured for deployment", "deployment", deployment.ID, "Skipping request", "releaseTarget", request.ReleaseTarget.GetID(), "version", request.Version.ID)
		return nil, nil
	}

	jobAgentConfig := deployment.GetJobAgentConfig()

	return &job.Job{
		ID:             uuid.New().String(),
		JobAgentID:     jobAgentID,
		JobAgentConfig: jobAgentConfig,
		Status:         job.JobStatusPending,
		Reason:         job.JobReasonPolicyPassing,
	}, nil
}

func (jd *JobDispatcher) DispatchJobs(ctx context.Context, requests []JobDispatchRequest) error {
	log.Info("Dispatching jobs", "count", len(requests))
	for _, request := range requests {
		job, err := jd.createJob(ctx, request)
		if err != nil {
			log.Error("Error creating job", "error", err)
			continue
		}
		if job == nil {
			continue
		}

		jd.repository.Job.Create(ctx, job)
	}

	return nil
}
