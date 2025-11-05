package resources

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/gin-gonic/gin"
)

type Resources struct{}

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
