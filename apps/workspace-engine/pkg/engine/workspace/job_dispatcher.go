package workspace

import (
	"context"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model/deployment"

	"github.com/charmbracelet/log"
)

type JobDispatchRequest struct {
	ReleaseTarget *rt.ReleaseTarget
	Versions      *deployment.DeploymentVersion
}

type JobDispatcher struct {
	repository *WorkspaceRepository
}

func NewJobDispatcher() *JobDispatcher {
	return &JobDispatcher{
		repository: NewWorkspaceRepository(),
	}
}

func (jd *JobDispatcher) DispatchJobs(ctx context.Context, requests []JobDispatchRequest) error {
	log.Info("Dispatching jobs", "count", len(requests))
	return nil
}
