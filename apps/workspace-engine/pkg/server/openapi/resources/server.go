package resources

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/releasemanager"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type Resources struct{}

var resourceTracer = otel.Tracer("server/openapi/resources")

func (r *Resources) GetResourceByIdentifier(c *gin.Context, workspaceId string, resourceIdentifier string) {
	// URL decode the identifier (in case it contains special characters like slashes)
	decodedIdentifier, err := url.PathUnescape(resourceIdentifier)
	if err != nil {
		fmt.Println("Failed to decode resourceIdentifier:", resourceIdentifier, "error:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid resource identifier: " + err.Error(),
		})
		return
	}

	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	// Iterate through resources to find by identifier
	resources := ws.Resources().Items()
	for _, resource := range resources {
		if resource.Identifier == decodedIdentifier {
			fmt.Println("Found matching resource:", resource.Identifier)
			c.JSON(http.StatusOK, resource)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Resource not found",
	})
}

func getMatchedResources(c *gin.Context, ws *workspace.Workspace, filter *oapi.Selector) ([]*oapi.Resource, error) {
	allResources := ws.Resources().Items()
	var matchedResources []*oapi.Resource
	if filter == nil {
		matchedResources = make([]*oapi.Resource, 0, len(allResources))
		for _, resource := range allResources {
			matchedResources = append(matchedResources, resource)
		}

		return matchedResources, nil
	}

	sel, err := filter.AsCelSelector()
	if err != nil {
		return nil, fmt.Errorf("failed to convert filter to cel selector: %w, %s", err, string(sel.Cel))
	}

	resourceSlice := make([]*oapi.Resource, 0, len(allResources))
	for _, resource := range allResources {
		resourceSlice = append(resourceSlice, resource)
	}

	// Filter resources using the selector
	matchedResources, err = selector.Filter(
		c.Request.Context(), filter, resourceSlice,
		selector.WithChunking(100, 10),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to filter resources: %w", err)
	}

	return matchedResources, nil
}

func (r *Resources) QueryResources(c *gin.Context, workspaceId string, params oapi.QueryResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	// Parse request body
	var body oapi.QueryResourcesJSONBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	matchedResources, err := getMatchedResources(c, ws, body.Filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get matched resources: " + err.Error(),
		})
		return
	}

	// Sort all matched resources (necessary for consistent pagination)
	sort.Slice(matchedResources, func(i, j int) bool {
		if matchedResources[i].Name == matchedResources[j].Name {
			return matchedResources[i].CreatedAt.Before(matchedResources[j].CreatedAt)
		}
		return matchedResources[i].Name < matchedResources[j].Name
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

	total := len(matchedResources)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := matchedResources[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}

func (r *Resources) GetRelationshipsForResource(c *gin.Context, workspaceId string, resourceIdentifier string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	resource, ok := ws.Resources().Get(resourceIdentifier)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	relatableEntity := relationships.NewResourceEntity(resource)
	relatedEntities, err := ws.RelationshipRules().GetRelatedEntities(c.Request.Context(), relatableEntity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get relationships: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, relatedEntities)
}

func (r *Resources) GetVariablesForResource(c *gin.Context, workspaceId string, resourceIdentifier string) {
	_, span := resourceTracer.Start(c.Request.Context(), "GetVariablesForResource")
	defer span.End()

	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("resource.identifier", resourceIdentifier),
	)

	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to get workspace")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	allResources := ws.Resources().Items()
	var resource *oapi.Resource
	for _, r := range allResources {
		if r.Identifier == resourceIdentifier {
			resource = r
			break
		}
	}

	if resource == nil {
		span.RecordError(fmt.Errorf("resource not found"))
		span.SetStatus(codes.Error, "Resource not found")
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	span.SetAttributes(
		attribute.String("resource.id", resource.Id),
	)

	allVariables := ws.ResourceVariables().Items()
	variables := make([]oapi.ResourceVariable, 0, len(allVariables))
	for _, variable := range allVariables {
		if variable.ResourceId == resource.Id {
			variables = append(variables, *variable)
		}
	}

	span.SetAttributes(
		attribute.Int("variables.count", len(variables)),
	)

	c.JSON(http.StatusOK, variables)
}

func (r *Resources) GetReleaseTargetsForResource(c *gin.Context, workspaceId string, resourceIdentifier string, params oapi.GetReleaseTargetsForResourceParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	allResources := ws.Resources().Items()
	var resource *oapi.Resource
	for _, r := range allResources {
		if r.Identifier == resourceIdentifier {
			resource = r
			break
		}
	}

	if resource == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Resource not found",
		})
		return
	}

	releaseTargets := ws.ReleaseTargets().GetForResource(c.Request.Context(), resource.Id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get release targets: " + err.Error(),
		})
		return
	}

	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, releaseTarget := range releaseTargets {
		if releaseTarget == nil {
			log.Error("release target is nil", "releaseTarget", fmt.Sprintf("%+v", releaseTarget))
			continue
		}
		if releaseTarget.ResourceId == resource.Id {
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}

	sort.Slice(releaseTargetsList, func(i, j int) bool {
		return releaseTargetsList[i].Key() < releaseTargetsList[j].Key()
	})

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

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
		res, exists := ws.Resources().Get(resourceId)
		if !exists {
			continue
		}
		entity := relationships.NewResourceEntity(res)
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

			res, ok := ws.Resources().Get(releaseTarget.ResourceId)
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
				Resource:      *res,
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
	for _, res := range results {
		if res.err != nil {
			log.Warn("Skipping invalid release target", "error", res.err.Error())
			skippedCount++
			continue
		}
		if res.item != nil {
			releaseTargetsWithState = append(releaseTargetsWithState, res.item)
		}
	}

	if skippedCount > 0 {
		log.Warn("Skipped invalid release targets in GetReleaseTargetsForResource",
			"resourceId", resource.Id,
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
