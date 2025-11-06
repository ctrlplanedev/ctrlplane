package jobs

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"

	"github.com/gin-gonic/gin"
)

type Jobs struct{}

func (s *Jobs) GetJob(c *gin.Context, workspaceId string, jobId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
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

func (s *Jobs) GetJobWithRelease(c *gin.Context, workspaceId string, jobId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	job, ok := ws.Jobs().Get(jobId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	release, ok := ws.Releases().Get(job.ReleaseId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release not found",
		})
		return
	}

	environment, ok := ws.Environments().Get(release.ReleaseTarget.EnvironmentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Environment not found",
		})
		return
	}

	deployment, ok := ws.Deployments().Get(release.ReleaseTarget.DeploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	resource, ok := ws.Resources().Get(release.ReleaseTarget.ResourceId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	c.JSON(http.StatusOK, &oapi.JobWithRelease{
		Job:         *job,
		Release:     *release,
		Environment: environment,
		Deployment:  deployment,
		Resource:    resource,
	})
}

func (s *Jobs) getJobWithRelease(ws *workspace.Workspace, job *oapi.Job) *oapi.JobWithRelease {
	release, ok := ws.Releases().Get(job.ReleaseId)
	if !ok {
		return nil
	}

	environment, ok := ws.Environments().Get(release.ReleaseTarget.EnvironmentId)
	if !ok {
		return nil
	}

	deployment, ok := ws.Deployments().Get(release.ReleaseTarget.DeploymentId)
	if !ok {
		return nil
	}

	resource, ok := ws.Resources().Get(release.ReleaseTarget.ResourceId)
	if !ok {
		return nil
	}

	return &oapi.JobWithRelease{
		Job:         *job,
		Release:     *release,
		Environment: environment,
		Deployment:  deployment,
		Resource:    resource,
	}
}

func (s *Jobs) getFilteredJobs(ws *workspace.Workspace, allJobs []*oapi.Job, params oapi.GetJobsParams) ([]*oapi.JobWithRelease, error) {
	filteredJobs := make([]*oapi.JobWithRelease, 0)

	for _, job := range allJobs {
		jobWithRelease := s.getJobWithRelease(ws, job)
		if jobWithRelease == nil {
			continue
		}

		if params.ResourceId != nil && jobWithRelease.Resource.Id != *params.ResourceId {
			continue
		}

		if params.EnvironmentId != nil && jobWithRelease.Environment.Id != *params.EnvironmentId {
			continue
		}

		if params.DeploymentId != nil && jobWithRelease.Deployment.Id != *params.DeploymentId {
			continue
		}

		filteredJobs = append(filteredJobs, jobWithRelease)
	}

	return filteredJobs, nil
}

func (s *Jobs) GetJobs(c *gin.Context, workspaceId string, params oapi.GetJobsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	jobs := ws.Jobs().Items()
	items := make([]*oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		items = append(items, job)
	}

	// Sort jobs by CreatedAt, newest first
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	hasFilterParams := params.ResourceId != nil || params.EnvironmentId != nil || params.DeploymentId != nil
	if hasFilterParams {
		filteredJobs, err := s.getFilteredJobs(ws, items, params)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to get filtered jobs: " + err.Error(),
			})
			return
		}

		filteredTotal := len(filteredJobs)
		filteredStart := min(offset, filteredTotal)
		filteredEnd := min(filteredStart+limit, filteredTotal)

		c.JSON(http.StatusOK, gin.H{
			"total":  filteredTotal,
			"offset": offset,
			"limit":  limit,
			"items":  filteredJobs[filteredStart:filteredEnd],
		})
		return
	}

	total := len(items)
	start := min(offset, total)
	end := min(start+limit, total)

	jobsWithRelease := make([]*oapi.JobWithRelease, 0, end-start)

	for _, job := range items[start:end] {
		jobWithRelease := s.getJobWithRelease(ws, job)
		if jobWithRelease != nil {
			jobsWithRelease = append(jobsWithRelease, jobWithRelease)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  jobsWithRelease,
	})
}
