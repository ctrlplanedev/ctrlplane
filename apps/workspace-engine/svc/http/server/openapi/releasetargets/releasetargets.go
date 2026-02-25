package releasetargets

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	celselector "workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/util"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/http/server/openapi/utils"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

type ReleaseTargets struct {
}

func (s *ReleaseTargets) GetReleaseTargetDesiredRelease(c *gin.Context, workspaceId string, releaseTargetKey string) {
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

	desiredRelease, err := ws.ReleaseManager().Planner().PlanDeployment(c.Request.Context(), releaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to plan release target: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"desiredRelease": desiredRelease,
	})
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

	resource, ok := ws.Resources().Get(req.ReleaseTarget.ResourceId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Failed to get resource: " + req.ReleaseTarget.ResourceId,
		})
		return
	}

	deployment, ok := ws.Deployments().Get(req.ReleaseTarget.DeploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Failed to get deployment: " + req.ReleaseTarget.DeploymentId,
		})
		return
	}

	decision := policy.NewDeployDecision()
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     &req.Version,
		Resource:    resource,
		Deployment:  deployment,
	}
	for _, policy := range policies {
		policyResult := policyManager.EvaluateWithPolicy(c.Request.Context(), policy, scope, policyManager.SummaryPolicyEvaluators)
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

	releaseTarget := ws.ReleaseTargets().Get(releaseTargetId)
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

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

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

func (s *ReleaseTargets) GetReleaseTargetStates(c *gin.Context, workspaceId string, params oapi.GetReleaseTargetStatesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req oapi.GetReleaseTargetStatesJSONRequestBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	allTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filtered := make([]*oapi.ReleaseTarget, 0)
	for _, rt := range allTargets {
		if rt != nil && rt.DeploymentId == req.DeploymentId && rt.EnvironmentId == req.EnvironmentId {
			filtered = append(filtered, rt)
		}
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Key() < filtered[j].Key()
	})

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(filtered)
	start := min(offset, total)
	end := min(start+limit, total)
	page := filtered[start:end]

	items := make([]oapi.ReleaseTargetAndState, 0, len(page))
	for _, rt := range page {
		state, err := ws.ReleaseManager().GetReleaseTargetState(c.Request.Context(), rt)
		if err != nil {
			log.Warn("Failed to get state for release target", "key", rt.Key(), "error", err.Error())
			continue
		}
		if state == nil {
			state = &oapi.ReleaseTargetState{}
		}
		items = append(items, oapi.ReleaseTargetAndState{
			ReleaseTarget: *rt,
			State:         *state,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

func (s *ReleaseTargets) GetReleaseTargetState(c *gin.Context, workspaceId string, releaseTargetKey string, params oapi.GetReleaseTargetStateParams) {
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

	// When bypass is requested, force a full recompute for this entity before reading
	if params.BypassCache != nil && *params.BypassCache {
		ws.ReleaseManager().RecomputeEntity(c.Request.Context(), releaseTarget)
	}

	state, err := ws.ReleaseManager().GetReleaseTargetState(c.Request.Context(), releaseTarget)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get release target state: " + err.Error(),
		})
		return
	}

	if state == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Release target state not found",
		})
		return
	}

	c.JSON(http.StatusOK, state)
}
