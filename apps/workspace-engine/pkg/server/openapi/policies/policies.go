package policies

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Policies struct{}

func (p *Policies) GetReleaseTargetsForPolicy(c *gin.Context, workspaceId oapi.WorkspaceId, policyId oapi.PolicyId) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Workspace not found",
		})
		return
	}

	// policy, ok := ws.Policies().Get(policyId)
	// if !ok {
	// 	c.JSON(http.StatusNotFound, gin.H{
	// 		"error": "Policy not found",
	// 	})
	// 	return
	// }

	// releaseTargets, err := ws.ReleaseTargets().Items(c.Request.Context())
	// if err != nil {
	// 	c.JSON(http.StatusInternalServerError, gin.H{
	// 		"error": "Failed to get release targets for policy: " + err.Error(),
	// 	})
	// 	return
	// }

	c.JSON(http.StatusInternalServerError, gin.H{
		"error": "Not implemented",
	})
}
