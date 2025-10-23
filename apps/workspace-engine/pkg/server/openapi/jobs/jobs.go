package jobs

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

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

	total := len(items)
	start := min(offset, total)
	end := min(start+limit, total)

	jobsWithRelease := make([]*oapi.JobWithRelease, 0, end-start)
	for _, job := range items[start:end] {
		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		environment, ok := ws.Environments().Get(release.ReleaseTarget.EnvironmentId)
		if !ok {
			continue
		}
		deployment, ok := ws.Deployments().Get(release.ReleaseTarget.DeploymentId)
		if !ok {
			continue
		}
		resource, ok := ws.Resources().Get(release.ReleaseTarget.ResourceId)
		if !ok {
			continue
		}
		jobsWithRelease = append(jobsWithRelease, &oapi.JobWithRelease{
			Job:         *job,
			Release:     *release,
			Environment: environment,
			Deployment:  deployment,
			Resource:    resource,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  jobsWithRelease,
	})
}