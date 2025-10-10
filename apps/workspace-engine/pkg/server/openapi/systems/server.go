package systems

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/server/openapi/utils"
)

type Systems struct{}

func New() *Systems {
	return &Systems{}
}

func (s *Systems) ListSystems(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	systems := ws.Systems()
	c.JSON(http.StatusOK, gin.H{
		"systems": systems,
	})
}

func (s *Systems) GetSystem(c *gin.Context, workspaceId string, systemId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
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
