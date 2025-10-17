package systems

import (
	"net/http"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Systems struct{}

func (s *Systems) GetSystem(c *gin.Context, workspaceId string, systemId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	system, ok := ws.Systems().Get(systemId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "System not found",
		})
		return
	}

	c.JSON(http.StatusOK, system)
}
