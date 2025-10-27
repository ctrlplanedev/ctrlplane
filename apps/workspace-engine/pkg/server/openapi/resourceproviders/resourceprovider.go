package resourceproviders

import (
	"fmt"
	"net/http"
	"net/url"
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