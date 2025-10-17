package policies

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Policies struct{}

func (p *Policies) GetReleaseTargetsForPolicy(c *gin.Context, workspaceId string, policyId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	policy, ok := ws.Policies().Get(policyId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Policy not found",
		})
		return
	}

	releaseTargets, err := ws.ReleaseTargets().Items(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get release targets for policy: " + err.Error(),
		})
		return
	}

	matchingReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
		if !ok {
			continue
		}
		deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
		if !ok {
			continue
		}
		resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
		if !ok {
			continue
		}
		resolvedReleaseTarget := selector.NewBasicReleaseTarget(environment, deployment, resource)
		if selector.MatchPolicy(c.Request.Context(), policy, resolvedReleaseTarget) {
			matchingReleaseTargets = append(matchingReleaseTargets, releaseTarget)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"releaseTargets": matchingReleaseTargets,
	})
}
