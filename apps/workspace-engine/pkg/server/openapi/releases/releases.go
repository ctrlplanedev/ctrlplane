package releases

import (
	"net/http"
	"workspace-engine/pkg/oapi"
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

func (s *Releases) GetReleaseVerifications(c *gin.Context, workspaceId string, releaseId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Check if the release exists
	_, ok := ws.Releases().Get(releaseId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release not found",
		})
		return
	}

	// Get all verifications for jobs belonging to this release
	verifications := ws.Store().JobVerifications.GetByReleaseId(releaseId)

	// Return empty array if no verifications found (not an error)
	if verifications == nil {
		verifications = []*oapi.JobVerification{}
	}

	c.JSON(http.StatusOK, verifications)
}
