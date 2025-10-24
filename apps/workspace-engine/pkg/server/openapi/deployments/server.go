package deployments

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Deployments struct{}

func (s *Deployments) GetDeployment(c *gin.Context, workspaceId string, deploymentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	deployment, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

func (s *Deployments) GetDeploymentResources(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetDeploymentResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resources, err := ws.Deployments().Resources(deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resourceList := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceList = append(resourceList, resource)
	}

	// Sort the resourceList by resource.Name (nil-safe, ascending); if Name is the same, sort by CreatedAt
	sort.Slice(resourceList, func(i, j int) bool {
		if resourceList[i] == nil && resourceList[j] == nil {
			return false
		}
		if resourceList[i] == nil {
			return false
		}
		if resourceList[j] == nil {
			return true
		}
		if resourceList[i].Name < resourceList[j].Name {
			return true
		}
		if resourceList[i].Name > resourceList[j].Name {
			return false
		}
		// Names are equal; compare CreatedAt
		return resourceList[i].CreatedAt.Before(resourceList[j].CreatedAt)
	})

	// Get pagination parameters with defaults
	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(resourceList)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := resourceList[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}

func (s *Deployments) ListDeployments(c *gin.Context, workspaceId string, params oapi.ListDeploymentsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	deployments := ws.Deployments().Items()

	// Get pagination parameters with defaults
	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(deployments)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)

	deploymentsList := make([]*oapi.Deployment, 0, total)
	for _, deployment := range deployments {
		deploymentsList = append(deploymentsList, deployment)
	}

	// Sort the deploymentsList by deployment.Name (nil-safe, ascending); if Name is the same, sort by CreatedAt
	sort.Slice(deploymentsList, func(i, j int) bool {
		if deploymentsList[i] == nil && deploymentsList[j] == nil {
			return false
		}
		if deploymentsList[i] == nil {
			return false
		}
		if deploymentsList[j] == nil {
			return true
		}
		if deploymentsList[i].Name < deploymentsList[j].Name {
			return true
		}
		if deploymentsList[i].Name > deploymentsList[j].Name {
			return false
		}
		// Names are equal; compare CreatedAt
		return deploymentsList[i].Id < deploymentsList[j].Id
	})

	deploymentsWithSystem := make([]*oapi.DeploymentAndSystem, 0, total)
	for _, deployment := range deploymentsList[start:end] {
		system, ok := ws.Systems().Get(deployment.SystemId)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "System not found for deployment",
			})
			return
		}
		// Use struct literal yielding + anonymous struct literal for "System"
		dws := &oapi.DeploymentAndSystem{
			Deployment: *deployment,
			System:     *system,
		}
		deploymentsWithSystem = append(deploymentsWithSystem, dws)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  deploymentsWithSystem,
	})
}

func (s *Deployments) GetReleaseTargetsForDeployment(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetReleaseTargetsForDeploymentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	releaseTargets, err := ws.ReleaseTargets().Items(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(releaseTargets)
	start := min(offset, total)
	end := min(start+limit, total)

	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, total)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.DeploymentId == deploymentId {
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}

	releaseTargetsWithState := make([]*oapi.ReleaseTargetWithState, 0, total)
	for _, releaseTarget := range releaseTargetsList[start:end] {
		state, err := ws.ReleaseManager().GetReleaseTargetState(c.Request.Context(), releaseTarget)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}
		environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Environment not found for release target",
			})
			return
		}
		resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Resource not found for release target",
			})
			return
		}
		deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Deployment not found for release target",
			})
			return
		}
		releaseTargetsWithState = append(releaseTargetsWithState, &oapi.ReleaseTargetWithState{
			ReleaseTarget: *releaseTarget,
			State:         *state,
			Environment:   environment,
			Resource:      resource,
			Deployment:    deployment,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  releaseTargetsWithState,
	})
}

func (s *Deployments) GetVersionsForDeployment(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetVersionsForDeploymentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	versions := ws.DeploymentVersions().Items()
	versionsList := make([]*oapi.DeploymentVersion, 0, len(versions))
	for _, version := range versions {
		if version.DeploymentId == deploymentId {
			versionsList = append(versionsList, version)
		}
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(versionsList)
	start := min(offset, total)
	end := min(start+limit, total)

	// Sort versionsList by CreatedAt descending (newest first)
	sort.Slice(versionsList, func(i, j int) bool {
		return versionsList[j].CreatedAt.Before(versionsList[i].CreatedAt)
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  versionsList[start:end],
	})
}
