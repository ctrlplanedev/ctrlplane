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
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}
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

	c.JSON(http.StatusOK, deployments)

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

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  deploymentsList[start:end],
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
		releaseTargetsList = append(releaseTargetsList, releaseTarget)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  releaseTargetsList[start:end],
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

	// Sort versionsList by CreatedAt ascending
	sort.Slice(versionsList, func(i, j int) bool {
		return versionsList[i].CreatedAt.Before(versionsList[j].CreatedAt)
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  versionsList[start:end],
	})
}