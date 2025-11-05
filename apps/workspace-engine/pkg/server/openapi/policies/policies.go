package policies

import (
	"fmt"
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"

	"github.com/gin-gonic/gin"
)

type Policies struct{}

func (p *Policies) ListPolicies(c *gin.Context, workspaceId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	policiesMap := ws.Policies().Items()
	policyList := make([]*oapi.Policy, 0, len(policiesMap))
	for _, policy := range policiesMap {
		policyList = append(policyList, policy)
	}

	c.JSON(http.StatusOK, gin.H{
		"policies": policyList,
	})
}

func (p *Policies) GetPolicy(c *gin.Context, workspaceId string, policyId string) {
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

	c.JSON(http.StatusOK, policy)
}

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

	releaseTargets, err := ws.ReleaseTargets().Items()
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
		resolvedReleaseTarget := selector.NewResolvedReleaseTarget(environment, deployment, resource)
		if selector.MatchPolicy(c.Request.Context(), policy, resolvedReleaseTarget) {
			matchingReleaseTargets = append(matchingReleaseTargets, releaseTarget)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"releaseTargets": matchingReleaseTargets,
	})
}

func (p *Policies) GetRule(c *gin.Context, workspaceId string, policyId string, ruleId string) {
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

	for _, rule := range policy.Rules {
		if rule.Id == ruleId {
			c.JSON(http.StatusOK, rule)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{
		"error": fmt.Sprintf("Rule %s not found in policy %s", ruleId, policyId),
	})
}

func (p *Policies) EvaluatePolicies(c *gin.Context, workspaceId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	// Parse request body
	var req oapi.EvaluationScope
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	var environment *oapi.Environment
	if req.EnvironmentId != nil {
		var ok bool
		environment, ok = ws.Environments().Get(*req.EnvironmentId)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Environment not found",
			})
			return
		}
	}

	var version *oapi.DeploymentVersion
	if req.VersionId != nil {
		var ok bool
		version, ok = ws.DeploymentVersions().Get(*req.VersionId)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Version not found",
			})
			return
		}
	}

	decision := policy.NewDeployDecision()
	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	policies := map[string]*oapi.Policy{}

	rt, _ := ws.ReleaseTargets().Items()
	for _, releaseTarget := range rt {
		if scope.Environment != nil && releaseTarget.EnvironmentId != scope.Environment.Id {
			continue
		}
		if scope.Version != nil && releaseTarget.DeploymentId != scope.Version.DeploymentId {
			continue
		}
		rtp, err := ws.ReleaseTargets().GetPolicies(c.Request.Context(), releaseTarget)
		if err != nil {
			continue
		}
		for _, policy := range rtp {
			policies[policy.Id] = policy
		}
	}

	policyManager := policy.New(ws.Store())
	globalPolicy := results.NewPolicyEvaluation()
	for _, evaluator := range policyManager.PlannerGlobalEvaluators() {
		if !scope.HasFields(evaluator.ScopeFields()) {
			continue
		}
		result := evaluator.Evaluate(c.Request.Context(), scope)
		globalPolicy.RuleResults = append(globalPolicy.RuleResults, *result)
	}
	decision.PolicyResults = append(decision.PolicyResults, *globalPolicy)

	for _, policy := range policies {
		policyResult := policyManager.EvaluateWithPolicy(c.Request.Context(), policy, scope, policyManager.SummaryPolicyEvaluators)
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	c.JSON(http.StatusOK, gin.H{
		"decision": decision,
	})
}
