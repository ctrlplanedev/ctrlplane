package deploymentversions

import (
	"fmt"
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"

	"github.com/gin-gonic/gin"
)

type DeploymentVersions struct{}

func getSystemEnvironments(ws *workspace.Workspace, systemId string) []*oapi.Environment {
	environments := make([]*oapi.Environment, 0)
	for environment := range ws.Environments().IterBuffered() {
		if environment.Val.SystemId == systemId {
			environments = append(environments, environment.Val)
		}
	}

	return environments
}

func getEnvironmentReleaseTargets(releaseTargets []*oapi.ReleaseTarget, environmentId string) []*oapi.ReleaseTarget {
	environmentReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.EnvironmentId == environmentId {
			environmentReleaseTargets = append(environmentReleaseTargets, releaseTarget)
		}
	}
	return environmentReleaseTargets
}

func getDeploymentReleaseTargets(c *gin.Context, ws *workspace.Workspace, deploymentId string) ([]*oapi.ReleaseTarget, error) {
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	allReleaseTargets, err := ws.ReleaseTargets().Items(c.Request.Context())
	if err != nil {
		return nil, err
	}
	for _, releaseTarget := range allReleaseTargets {
		if releaseTarget.DeploymentId == deploymentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}
	return releaseTargets, nil
}

func getReleaseTargetJobs(ws *workspace.Workspace, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Job, error) {
	jobsMap := ws.Jobs().GetJobsForReleaseTarget(releaseTarget)
	jobs := make([]*oapi.Job, 0)
	for _, job := range jobsMap {
		jobs = append(jobs, job)
	}

	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].CreatedAt.After(jobs[j].CreatedAt)
	})
	return jobs, nil
}

type fullReleaseTarget struct {
	*oapi.ReleaseTarget
	Jobs        []*oapi.Job       `json:"jobs"`
	Environment *oapi.Environment `json:"environment,omitempty"`
	Deployment  *oapi.Deployment  `json:"deployment,omitempty"`
	Resource    *oapi.Resource    `json:"resource,omitempty"`
}

type environmentWithTargets struct {
	Environment    *oapi.Environment    `json:"environment"`
	ReleaseTargets []*fullReleaseTarget `json:"releaseTargets"`
}

func getFullReleaseTarget(ws *workspace.Workspace, releaseTarget *oapi.ReleaseTarget) (*fullReleaseTarget, error) {
	jobs, err := getReleaseTargetJobs(ws, releaseTarget)
	if err != nil {
		return nil, err
	}
	resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
	if !ok {
		return nil, fmt.Errorf("resource %s not found", releaseTarget.ResourceId)
	}
	return &fullReleaseTarget{
		ReleaseTarget: releaseTarget,
		Jobs:          jobs,
		Resource:      resource,
	}, nil
}

func (s *DeploymentVersions) GetDeploymentVersionJobsList(c *gin.Context, workspaceId string, versionId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	version, ok := ws.DeploymentVersions().Get(versionId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Errorf("deployment version %s not found", versionId).Error(),
		})
		return
	}

	deployment, ok := ws.Deployments().Get(version.DeploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Errorf("deployment %s not found", version.DeploymentId).Error(),
		})
		return
	}

	environments := getSystemEnvironments(ws, deployment.SystemId)
	releaseTargets, err := getDeploymentReleaseTargets(c, ws, deployment.Id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	envsWithTargets := make([]*environmentWithTargets, 0)

	for _, environment := range environments {
		environmentReleaseTargets := getEnvironmentReleaseTargets(releaseTargets, environment.Id)
		fullReleaseTargets := make([]*fullReleaseTarget, 0)
		for _, releaseTarget := range environmentReleaseTargets {
			fullReleaseTarget, err := getFullReleaseTarget(ws, releaseTarget)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": err.Error(),
				})
				return
			}
			fullReleaseTarget.Environment = environment
			fullReleaseTarget.Deployment = deployment
			fullReleaseTargets = append(fullReleaseTargets, fullReleaseTarget)
		}

		sort.Slice(fullReleaseTargets, func(i, j int) bool {
			return compareReleaseTargets(fullReleaseTargets[i], fullReleaseTargets[j]) < 0
		})
		envWithTarget := &environmentWithTargets{
			Environment:    environment,
			ReleaseTargets: fullReleaseTargets,
		}
		envsWithTargets = append(envsWithTargets, envWithTarget)
	}

	sort.Slice(envsWithTargets, func(i, j int) bool {
		return envsWithTargets[i].Environment.Name < envsWithTargets[j].Environment.Name
	})
	c.JSON(http.StatusOK, envsWithTargets)
}
