package resources

import (
	"fmt"
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Resources struct{}

func (r *Resources) GetResourceByIdentifier(c *gin.Context, workspaceId string, resourceIdentifier string) {
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
		if resource.Identifier == resourceIdentifier {
			c.JSON(http.StatusOK, resource)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Resource not found",
	})
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

	// Get all resources from workspace
	allResources := ws.Resources().Items()
	resourceSlice := make([]*oapi.Resource, 0, len(allResources))
	for _, resource := range allResources {
		resourceSlice = append(resourceSlice, resource)
	}

	fmt.Println(allResources)

	var matchedResourcesMap map[string]*oapi.Resource
	if body.Filter != nil {
		// Filter resources using the selector
		matchedResourcesMap, err = selector.FilterResources(c.Request.Context(), body.Filter, resourceSlice)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Failed to filter resources: " + err.Error(),
			})
			return
		}
	} else {
		matchedResourcesMap = make(map[string]*oapi.Resource)
		for _, resource := range resourceSlice {
			matchedResourcesMap[resource.Id] = resource
		}
	}

	// Convert map back to slice for response
	matchedResources := make([]*oapi.Resource, 0, len(matchedResourcesMap))
	for _, resource := range matchedResourcesMap {
		matchedResources = append(matchedResources, resource)
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

	total := len(matchedResources)
	
	// Apply pagination
	start := min(offset, total)
	end := min(start + limit, total)
	paginatedResources := matchedResources[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}
