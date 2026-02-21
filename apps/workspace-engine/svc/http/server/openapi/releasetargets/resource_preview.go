package releasetargets

import (
	"context"
	"net/http"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/svc/http/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type releaseTargetMatch struct {
	System      oapi.System      `json:"system"`
	Deployment  oapi.Deployment  `json:"deployment"`
	Environment oapi.Environment `json:"environment"`
}

func toResource(req *oapi.ResourcePreviewRequest) *oapi.Resource {
	return &oapi.Resource{
		Name:       req.Name,
		Version:    req.Version,
		Kind:       req.Kind,
		Identifier: req.Identifier,
		Config:     req.Config,
		Metadata:   req.Metadata,
		CreatedAt:  time.Time{},
	}
}

func matchEnvironments(ctx context.Context, ws *workspace.Workspace, systemId string, resource *oapi.Resource) ([]*oapi.Environment, error) {
	envs := ws.Systems().Environments(systemId)
	matched := make([]*oapi.Environment, 0, len(envs))

	for _, env := range envs {
		ok, err := selector.Match(ctx, env.ResourceSelector, resource)
		if err != nil {
			return nil, err
		}
		if ok {
			matched = append(matched, env)
		}
	}

	return matched, nil
}

func matchDeployments(ctx context.Context, ws *workspace.Workspace, systemId string, resource *oapi.Resource) ([]*oapi.Deployment, error) {
	deployments := ws.Systems().Deployments(systemId)
	matched := make([]*oapi.Deployment, 0, len(deployments))

	for _, dep := range deployments {
		ok, err := selector.Match(ctx, dep.ResourceSelector, resource)
		if err != nil {
			return nil, err
		}
		if ok {
			matched = append(matched, dep)
		}
	}

	return matched, nil
}

func buildMatches(system *oapi.System, deployments []*oapi.Deployment, environments []*oapi.Environment) []releaseTargetMatch {
	matches := make([]releaseTargetMatch, 0, len(deployments)*len(environments))
	for _, dep := range deployments {
		for _, env := range environments {
			matches = append(matches, releaseTargetMatch{
				System:      *system,
				Deployment:  *dep,
				Environment: *env,
			})
		}
	}
	return matches
}

func (s *ReleaseTargets) PreviewReleaseTargetsForResource(c *gin.Context, workspaceId string, params oapi.PreviewReleaseTargetsForResourceParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	var req oapi.ResourcePreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	resource := toResource(&req)
	ctx := c.Request.Context()

	var allMatches []releaseTargetMatch

	for _, system := range ws.Systems().Items() {
		matchedEnvs, err := matchEnvironments(ctx, ws, system.Id, resource)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to match environments: " + err.Error(),
			})
			return
		}
		if len(matchedEnvs) == 0 {
			continue
		}

		matchedDeps, err := matchDeployments(ctx, ws, system.Id, resource)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to match deployments: " + err.Error(),
			})
			return
		}
		if len(matchedDeps) == 0 {
			continue
		}

		allMatches = append(allMatches, buildMatches(system, matchedDeps, matchedEnvs)...)
	}

	sort.Slice(allMatches, func(i, j int) bool {
		if allMatches[i].System.Name != allMatches[j].System.Name {
			return allMatches[i].System.Name < allMatches[j].System.Name
		}
		if allMatches[i].Deployment.Name != allMatches[j].Deployment.Name {
			return allMatches[i].Deployment.Name < allMatches[j].Deployment.Name
		}
		return allMatches[i].Environment.Name < allMatches[j].Environment.Name
	})

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(allMatches)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"items":  allMatches[start:end],
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
