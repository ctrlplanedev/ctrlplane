package resources

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"

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
	
	var matchedResources []*oapi.Resource
	
	if body.Filter != nil {
		// Convert to slice first
		resourceSlice := make([]*oapi.Resource, 0, len(allResources))
		for _, resource := range allResources {
			resourceSlice = append(resourceSlice, resource)
		}
		
		// Filter resources using the selector
		matchedResources, err = selector.Filter(
			c.Request.Context(), body.Filter, resourceSlice,
			selector.WithChunking(100, 10),
		)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Failed to filter resources: " + err.Error(),
			})
			return
		}
	} else {
		// No filter - directly convert to slice (skip map entirely)
		matchedResources = make([]*oapi.Resource, 0, len(allResources))
		for _, resource := range allResources {
			matchedResources = append(matchedResources, resource)
		}
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