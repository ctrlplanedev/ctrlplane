package releasetargets

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/store"

	"github.com/gin-gonic/gin"
)

type ReleaseTargets struct {
	store *store.Store
}

func New(store *store.Store) *ReleaseTargets {
	return &ReleaseTargets{store: store}
}

// EvaluateReleaseTarget implements oapi.ServerInterface.
func (s *ReleaseTargets) EvaluateReleaseTarget(c *gin.Context, workspaceId oapi.WorkspaceId) {
	// Get workspace
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Workspace not found",
		})
		return
	}

	// Parse request body
	var req oapi.EvaluateReleaseTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	// Create policy manager
	policyManager := policy.New(ws.Store())

	policies, err := policyManager.GetPoliciesForReleaseTarget(c.Request.Context(), &req.ReleaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get policies for release target: " + err.Error(),
		})
		return
	}

	workspaceDecision, err := policyManager.EvaluateWorkspace(c.Request.Context(), policies)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to evaluate workspace policies: " + err.Error(),
		})
		return
	}

	// Evaluate the version for this release target
	versionDecision, err := policyManager.EvaluateVersion(c.Request.Context(), &req.Version, &req.ReleaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to evaluate policies: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policiesEvaulated": len(policies),
		"workspaceDecision": workspaceDecision,
		"versionDecision":   versionDecision,
	})
}
