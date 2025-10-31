package releasetargets

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	celselector "workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/util"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/gin-gonic/gin"
)

type ReleaseTargets struct {
}

// EvaluateReleaseTarget implements oapi.ServerInterface.
func (s *ReleaseTargets) EvaluateReleaseTarget(c *gin.Context, workspaceId string) {
	// Get workspace
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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

	policies, err := ws.ReleaseTargets().GetPolicies(c.Request.Context(), &req.ReleaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get policies for release target: " + err.Error(),
		})
		return
	}

	environment, ok := ws.Environments().Get(req.ReleaseTarget.EnvironmentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Failed to get environment: " + req.ReleaseTarget.EnvironmentId,
		})
		return
	}

	decision := policy.NewDeployDecision()
	scope := evaluator.EvaluatorScope{
		Environment:   environment,
		Version:       &req.Version,
		ReleaseTarget: &req.ReleaseTarget,
	}
	for _, policy := range policies {
		policyResult := policyManager.EvaluatePolicy(c.Request.Context(), policy, scope)
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	c.JSON(http.StatusOK, gin.H{
		"policiesEvaulated": len(policies),
		"decision":          decision,
	})
}

// GetPoliciesForReleaseTarget implements oapi.ServerInterface.
func (s *ReleaseTargets) GetPoliciesForReleaseTarget(c *gin.Context, workspaceId string, releaseTargetId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	releaseTarget := ws.ReleaseTargets().FromId(string(releaseTargetId))
	if releaseTarget == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release target not found",
		})
		return
	}

	policies, err := ws.ReleaseTargets().GetPolicies(c.Request.Context(), releaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get policies for release target: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policies,
	})
}

func (s *ReleaseTargets) GetJobsForReleaseTarget(c *gin.Context, workspaceId string, releaseTargetKey string, params oapi.GetJobsForReleaseTargetParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	releaseTarget := ws.ReleaseTargets().Get(releaseTargetKey)
	if releaseTarget == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release target not found",
		})
		return
	}

	jobs := ws.Jobs().GetJobsForReleaseTarget(releaseTarget)
	items := make([]*oapi.Job, 0, len(jobs))

	var matcher util.MatchableCondition = nil
	if params.Cel != nil {
		matcher, err = celselector.Compile(*params.Cel)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Failed to compile cel expression: " + err.Error(),
			})
			return
		}
	}

	for _, job := range jobs {
		release, ok := ws.Releases().Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		if release.ReleaseTarget.Key() != releaseTargetKey {
			continue
		}

		if matcher != nil {
			matches, err := matcher.Matches(job)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to match job: " + err.Error(),
				})
				return
			}
			if !matches {
				continue
			}
		}
		items = append(items, job)
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	total := len(items)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"items":  items[start:end],
		"total":  total,
		"offset": params.Offset,
		"limit":  params.Limit,
	})
}
