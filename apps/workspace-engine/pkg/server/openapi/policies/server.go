package policies

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type Policies struct{}

func New() *Policies {
	return &Policies{}
}

func (s *Policies) ListPolicies(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	releaseTargetsMap := ws.ReleaseTargets().Items(c)
	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, len(releaseTargetsMap))
	for _, target := range releaseTargetsMap {
		releaseTargetsList = append(releaseTargetsList, target)
	}
	c.JSON(http.StatusOK, gin.H{
		"releaseTargets": releaseTargetsList,
	})
}

func (s *Policies) GetPolicy(c *gin.Context, workspaceId string, policyId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	policy, ok := ws.Policies().Get(policyId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Policy not found",
		})
		return
	}

	c.JSON(http.StatusOK, policy)
}
