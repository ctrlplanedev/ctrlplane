package resourceproviders

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

type ResourceProviders struct{}

func (s *ResourceProviders) GetResourceProviderByName(c *gin.Context, workspaceId string, name string) {
	decodedName, err := url.PathUnescape(name)
	if err != nil {
		fmt.Println("Failed to decode provider name:", name, "error:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid provider name: " + err.Error(),
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

	for _, provider := range ws.ResourceProviders().Items() {
		if provider.Name == decodedName {
			c.JSON(http.StatusOK, provider)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": "Resource provider not found",
	})
}

func (s *ResourceProviders) GetResourceProviders(c *gin.Context, workspaceId string, params oapi.GetResourceProvidersParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	providers := ws.ResourceProviders().Items()

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(providers)
	start := min(offset, total)
	end := min(start+limit, total)

	providersList := make([]*oapi.ResourceProvider, 0, total)
	for _, provider := range providers {
		providersList = append(providersList, provider)
	}

	// Sort providersList by provider.Name (ascending)
	sort.Slice(providersList, func(i, j int) bool {
		return providersList[i].Name < providersList[j].Name
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  providersList[start:end],
	})
}

// CacheBatch temporarily stores a large resource batch in memory
// This allows the API to send a small Kafka event with just a reference
func (s *ResourceProviders) CacheBatch(c *gin.Context, workspaceId string) {
	// Parse request body
	var body struct {
		ProviderId string           `json:"providerId" binding:"required"`
		Resources  []*oapi.Resource `json:"resources" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	// Get batch cache
	cache := store.GetResourceProviderBatchCache()

	// Store in cache
	batchId, err := cache.Store(c.Request.Context(), body.ProviderId, body.Resources)
	if err != nil {
		log.Error("Failed to cache batch", "error", err)
		c.JSON(http.StatusInsufficientStorage, gin.H{
			"error": "Failed to cache batch: " + err.Error(),
		})
		return
	}

	log.Info("Cached resource batch",
		"batchId", batchId,
		"workspaceId", workspaceId,
		"providerId", body.ProviderId,
		"resourceCount", len(body.Resources))

	c.JSON(http.StatusOK, gin.H{
		"batchId":       batchId,
		"resourceCount": len(body.Resources),
	})
}
