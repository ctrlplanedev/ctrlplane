package jobs

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Jobs struct{}

func New() *Jobs {
	return &Jobs{}
}

func (s *Jobs) ListJobs(c *gin.Context, workspaceId string, params oapi.ListJobsParams) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	jobsMap := ws.Jobs().Items()

	// Filter jobs based on query parameters if provided
	filteredJobs := make([]*oapi.Job, 0, len(jobsMap))
	for _, job := range jobsMap {
		// Apply filters if provided
		if params.ReleaseId != nil && job.ReleaseId != *params.ReleaseId {
			continue
		}
		if params.DeploymentId != nil && job.DeploymentId != *params.DeploymentId {
			continue
		}
		if params.EnvironmentId != nil && job.EnvironmentId != *params.EnvironmentId {
			continue
		}
		if params.ResourceId != nil && job.ResourceId != *params.ResourceId {
			continue
		}
		filteredJobs = append(filteredJobs, job)
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs": filteredJobs,
	})
}

func (s *Jobs) GetJob(c *gin.Context, workspaceId string, jobId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	job, ok := ws.Jobs().Get(jobId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, job)
}
