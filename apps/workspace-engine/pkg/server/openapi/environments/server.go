package environments

import (
	"context"
	"fmt"
	"net/http"
	"sort"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/releasemanager"
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

	sort.Slice(resources, func(i, j int) bool {
		if resources[i] == nil && resources[j] == nil {
			return false
		}
		if resources[i] == nil {
			return false
		}
		if resources[j] == nil {
			return true
		}
		if resources[i].Name < resources[j].Name {
			return true
		}
		if resources[i].Name > resources[j].Name {
			return false
		}
		// Names are equal; compare Id
		return resources[i].Id < resources[j].Id
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

	total := len(resources)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := resources[start:end]

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

	// Pre-compute relationships for unique resources to avoid redundant GetRelatedEntities calls
	paginatedTargets := releaseTargetsList[start:end]
	uniqueResourceIds := make(map[string]bool)
	for _, rt := range paginatedTargets {
		uniqueResourceIds[rt.ResourceId] = true
	}

	// Batch compute relationships
	resourceRelationshipsMap := make(map[string]map[string][]*oapi.EntityRelation)
	for resourceId := range uniqueResourceIds {
		resource, exists := ws.Resources().Get(resourceId)
		if !exists {
			continue
		}
		entity := relationships.NewResourceEntity(resource)
		relatedEntities, _ := ws.Store().Relationships.GetRelatedEntities(c.Request.Context(), entity)
		resourceRelationshipsMap[resourceId] = relatedEntities
	}

	// Process each release target, logging errors but continuing with valid ones
	releaseTargetsWithState := make([]*oapi.ReleaseTargetWithState, 0, end-start)
	skippedCount := 0

	type result struct {
		item *oapi.ReleaseTargetWithState
		err  error
	}

	results, err := concurrency.ProcessInChunks(
		c.Request.Context(),
		paginatedTargets,
		func(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (result, error) {
			if releaseTarget == nil {
				return result{nil, fmt.Errorf("release target is nil")}, nil
			}

			// Use pre-computed relationships
			resourceRelationships := resourceRelationshipsMap[releaseTarget.ResourceId]
			state, err := ws.ReleaseManager().GetReleaseTargetState(
				c.Request.Context(),
				releaseTarget,
				releasemanager.WithResourceRelationships(resourceRelationships),
			)
			if err != nil {
				return result{nil, fmt.Errorf("error getting release target state for key=%s: %w", releaseTarget.Key(), err)}, nil
			}

			environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
			if !ok {
				return result{nil, fmt.Errorf("environment not found: environmentId=%s for release target key=%s", releaseTarget.EnvironmentId, releaseTarget.Key())}, nil
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				return result{nil, fmt.Errorf("resource not found: resourceId=%s for release target key=%s", releaseTarget.ResourceId, releaseTarget.Key())}, nil
			}

			deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
			if !ok {
				return result{nil, fmt.Errorf("deployment not found: deploymentId=%s for release target key=%s", releaseTarget.DeploymentId, releaseTarget.Key())}, nil
			}

			item := &oapi.ReleaseTargetWithState{
				ReleaseTarget: *releaseTarget,
				State:         *state,
				Environment:   *environment,
				Resource:      *resource,
				Deployment:    *deployment,
			}
			return result{item, nil}, nil
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Filter out results with errors, log them
	for _, r := range results {
		if r.err != nil {
			log.Warn("Skipping invalid release target", "error", r.err.Error())
			skippedCount++
			continue
		}
		if r.item != nil {
			releaseTargetsWithState = append(releaseTargetsWithState, r.item)
		}
	}

	if skippedCount > 0 {
		log.Warn("Skipped invalid release targets in GetReleaseTargetsForEnvironment",
			"environmentId", environmentId,
			"skippedCount", skippedCount,
			"validCount", len(releaseTargetsWithState))
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  releaseTargetsWithState,
	})
}
