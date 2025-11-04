package releases

import (
	"net/http"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Releases struct {
}

func (s *Releases) GetRelease(c *gin.Context, workspaceId string, releaseId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	release, ok := ws.Releases().Get(releaseId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release not found",
		})
		return
	}

	c.JSON(http.StatusOK, release)
}
