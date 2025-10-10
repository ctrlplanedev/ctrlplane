package releases

import (
	"net/http"

	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Releases struct{}

func New() *Releases {
	return &Releases{}
}

// ListReleases implements oapi.ServerInterface.
func (s *Releases) ListReleases(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	releases := ws.Releases()
	c.JSON(http.StatusOK, gin.H{
		"releases": releases,
	})
}

func (s *Releases) GetRelease(c *gin.Context, workspaceId string, releaseId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
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
