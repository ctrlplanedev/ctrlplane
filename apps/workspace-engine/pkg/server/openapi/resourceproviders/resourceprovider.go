package resourceproviders

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

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
