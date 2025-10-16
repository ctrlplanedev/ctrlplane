package policies

import (
	"net/http"
	"workspace-engine/pkg/oapi"

	"github.com/gin-gonic/gin"
)

type Policies struct{}

func (p *Policies) GetReleaseTargetsForPolicy(c *gin.Context, workspaceId oapi.WorkspaceId, policyId oapi.PolicyId) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": "Not implemented",
	})
}
