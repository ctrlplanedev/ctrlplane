package githubentities

import (
	"fmt"
	"net/http"
	"workspace-engine/svc/http/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type GithubEntities struct{}

func (s *GithubEntities) GetGitHubEntityByInstallationId(c *gin.Context, workspaceId string, installationId int) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	allGithubEntities := ws.GithubEntities().Items()
	for _, githubEntity := range allGithubEntities {
		if githubEntity.InstallationId == installationId {
			c.JSON(http.StatusOK, githubEntity)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": fmt.Sprintf("GitHub entity not found for installation ID %d", installationId),
	})
}
