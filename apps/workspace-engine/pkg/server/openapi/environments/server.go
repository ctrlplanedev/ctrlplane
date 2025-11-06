package environments

import (
	"fmt"
	"net/http"
	"sort"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Environments struct{}

func (s *Environments) GetEnvironment(c *gin.Context, workspaceId string, environmentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	environment, ok := ws.Environments().Get(environmentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Environment not found",
		})
		return
	}

	c.JSON(http.StatusOK, environment)
}

func (s *Environments) ListEnvironments(c *gin.Context, workspaceId string, params oapi.ListEnvironmentsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	environments := ws.Environments().Items()

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(environments)
	start := min(offset, total)
	end := min(start+limit, total)

	environmentsList := make([]*oapi.Environment, 0, total)
	for _, environment := range environments {
		environmentsList = append(environmentsList, environment)
	}

	sort.Slice(environmentsList, func(i, j int) bool {
		if environmentsList[i] == nil && environmentsList[j] == nil {
			return false
		}
		if environmentsList[i] == nil {
			return false
		}
		if environmentsList[j] == nil {
			return true
		}
		if environmentsList[i].Name < environmentsList[j].Name {
			return true
		}
		if environmentsList[i].Name > environmentsList[j].Name {
			return false
		}
		// Names are equal; compare Id
		return environmentsList[i].Id < environmentsList[j].Id
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  environmentsList[start:end],
	})
}

func (s *Environments) GetEnvironmentResources(c *gin.Context, workspaceId string, environmentId string, params oapi.GetEnvironmentResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resources, err := ws.Environments().Resources(c.Request.Context(), environmentId)
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
		// Names are equal; compare Id
		return resourceList[i].Id < resourceList[j].Id
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

func (s *Environments) GetReleaseTargetsForEnvironment(c *gin.Context, workspaceId string, environmentId string, params oapi.GetReleaseTargetsForEnvironmentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	releaseTargets, err := ws.ReleaseTargets().Items()
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

	// Build list of release targets for this deployment, filtering out any nils
	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, releaseTarget := range releaseTargets {
		if releaseTarget == nil {
			log.Error("release target is nil", "releaseTarget", fmt.Sprintf("%+v", releaseTarget))
			continue
		}
		if releaseTarget.EnvironmentId == environmentId {
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}

	sort.Slice(releaseTargetsList, func(i, j int) bool {
		return releaseTargetsList[i].Key() < releaseTargetsList[j].Key()
	})

	total := len(releaseTargetsList)
	start := min(offset, total)
	end := min(start+limit, total)

	releaseTargetsWithState, err := concurrency.ProcessInChunks(
		releaseTargetsList[start:end],
		50,
		10, // Max 10 concurrent goroutines
		func(releaseTarget *oapi.ReleaseTarget) (*oapi.ReleaseTargetWithState, error) {
			if releaseTarget == nil {
				return nil, fmt.Errorf("release target is nil")
			}

			state, err := ws.ReleaseManager().GetCachedReleaseTargetState(c.Request.Context(), releaseTarget)
			if err != nil {
				return nil, fmt.Errorf("error getting release target state: %w", err)
			}

			environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
			if !ok {
				return nil, fmt.Errorf("environment not found for release target")
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				return nil, fmt.Errorf("resource not found for release target")
			}

			deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
			if !ok {
				return nil, fmt.Errorf("deployment not found for release target")
			}

			return &oapi.ReleaseTargetWithState{
				ReleaseTarget: *releaseTarget,
				State:         *state,
				Environment:   *environment,
				Resource:      *resource,
				Deployment:    *deployment,
			}, nil
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  releaseTargetsWithState,
	})
}
