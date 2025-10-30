package deployments

import (
	"fmt"
	"net/http"
	"sort"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

func getReleaseTargetsForDeployment(c *gin.Context, ws *workspace.Workspace, deploymentId string) ([]*oapi.ReleaseTarget, error) {
	releaseTargets, err := ws.ReleaseTargets().Items(c.Request.Context())
	if err != nil {
		return nil, err
	}
	// Build list of release targets for this deployment, filtering out any nils
	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, releaseTarget := range releaseTargets {
		if releaseTarget == nil {
			log.Error("release target is nil", "releaseTarget", fmt.Sprintf("%+v", releaseTarget))
			continue
		}
		if releaseTarget.DeploymentId == deploymentId {
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}

	return releaseTargetsList, nil
}

type Deployments struct{}

func (s *Deployments) GetDeployment(c *gin.Context, workspaceId string, deploymentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	deployment, ok := ws.Deployments().Get(deploymentId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment not found",
		})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

func (s *Deployments) GetDeploymentResources(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetDeploymentResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resources, err := ws.Deployments().Resources(deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resourceList := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceList = append(resourceList, resource)
	}

	// Sort the resourceList by resource.Name (nil-safe, ascending); if Name is the same, sort by CreatedAt
	sort.Slice(resourceList, func(i, j int) bool {
		if resourceList[i] == nil && resourceList[j] == nil {
			return false
		}
		if resourceList[i] == nil {
			return false
		}
		if resourceList[j] == nil {
			return true
		}
		if resourceList[i].Name < resourceList[j].Name {
			return true
		}
		if resourceList[i].Name > resourceList[j].Name {
			return false
		}
		// Names are equal; compare CreatedAt
		return resourceList[i].CreatedAt.Before(resourceList[j].CreatedAt)
	})

	// Get pagination parameters with defaults
	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(resourceList)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := resourceList[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}

func (s *Deployments) ListDeployments(c *gin.Context, workspaceId string, params oapi.ListDeploymentsParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	deployments := ws.Deployments().Items()

	// Get pagination parameters with defaults
	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(deployments)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)

	deploymentsList := make([]*oapi.Deployment, 0, total)
	for _, deployment := range deployments {
		deploymentsList = append(deploymentsList, deployment)
	}

	// Sort the deploymentsList by deployment.Name (nil-safe, ascending); if Name is the same, sort by CreatedAt
	sort.Slice(deploymentsList, func(i, j int) bool {
		if deploymentsList[i] == nil && deploymentsList[j] == nil {
			return false
		}
		if deploymentsList[i] == nil {
			return false
		}
		if deploymentsList[j] == nil {
			return true
		}
		if deploymentsList[i].Name < deploymentsList[j].Name {
			return true
		}
		if deploymentsList[i].Name > deploymentsList[j].Name {
			return false
		}
		// Names are equal; compare CreatedAt
		return deploymentsList[i].Id < deploymentsList[j].Id
	})

	deploymentsWithSystem := make([]*oapi.DeploymentAndSystem, 0, total)
	for _, deployment := range deploymentsList[start:end] {
		system, ok := ws.Systems().Get(deployment.SystemId)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "System not found for deployment",
			})
			return
		}
		// Use struct literal yielding + anonymous struct literal for "System"
		dws := &oapi.DeploymentAndSystem{
			Deployment: *deployment,
			System:     *system,
		}
		deploymentsWithSystem = append(deploymentsWithSystem, dws)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  deploymentsWithSystem,
	})
}

func (s *Deployments) GetReleaseTargetsForDeployment(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetReleaseTargetsForDeploymentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	// Build list of release targets for this deployment, filtering out any nils
	releaseTargetsList, err := getReleaseTargetsForDeployment(c, ws, deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	sort.Slice(releaseTargetsList, func(i, j int) bool {
		return releaseTargetsList[i].Key() < releaseTargetsList[j].Key()
	})

	total := len(releaseTargetsList)
	start := min(offset, total)
	end := min(start+limit, total)

	releaseTargetsWithState, err := concurrency.ProcessInChunks(
		releaseTargetsList[start:end],
		50,
		10, // Max 10 concurrent goroutines
		func(releaseTarget *oapi.ReleaseTarget) (*oapi.ReleaseTargetWithState, error) {
			if releaseTarget == nil {
				return nil, fmt.Errorf("release target is nil")
			}

			state, err := ws.ReleaseManager().GetCachedReleaseTargetState(c.Request.Context(), releaseTarget)
			if err != nil {
				return nil, fmt.Errorf("error getting release target state: %w", err)
			}

			environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
			if !ok {
				return nil, fmt.Errorf("environment not found for release target")
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				return nil, fmt.Errorf("resource not found for release target")
			}

			deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
			if !ok {
				return nil, fmt.Errorf("deployment not found for release target")
			}

			return &oapi.ReleaseTargetWithState{
				ReleaseTarget: *releaseTarget,
				State:         *state,
				Environment:   *environment,
				Resource:      *resource,
				Deployment:    *deployment,
			}, nil
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  releaseTargetsWithState,
	})
}

func (s *Deployments) GetVersionsForDeployment(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetVersionsForDeploymentParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	versions := ws.DeploymentVersions().Items()
	versionsList := make([]*oapi.DeploymentVersion, 0, len(versions))
	for _, version := range versions {
		if version.DeploymentId == deploymentId {
			versionsList = append(versionsList, version)
		}
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(versionsList)
	start := min(offset, total)
	end := min(start+limit, total)

	// Sort versionsList by CreatedAt descending (newest first)
	sort.Slice(versionsList, func(i, j int) bool {
		return versionsList[j].CreatedAt.Before(versionsList[i].CreatedAt)
	})

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  versionsList[start:end],
	})
}

func (s *Deployments) GetPoliciesForDeployment(c *gin.Context, workspaceId string, deploymentId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	releaseTargets, err := getReleaseTargetsForDeployment(c, ws, deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	policiesMap := make(map[string]*oapi.ResolvedPolicy)
	for _, releaseTarget := range releaseTargets {
		policies, err := ws.ReleaseTargets().GetPolicies(c.Request.Context(), releaseTarget)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}
		for _, policy := range policies {
			if p, ok := policiesMap[policy.Id]; ok {
				p.ReleaseTargets = append(p.ReleaseTargets, *releaseTarget)
				continue
			}

			envs := make([]string, 0)

			allEnvironments := ws.Environments().Items()
			envsList := make([]*oapi.Environment, 0, len(allEnvironments))
			for _, env := range ws.Environments().Items() {
				envsList = append(envsList, env)
			}

			for _, rule := range policy.Rules {
				if rule.EnvironmentProgression != nil {
					matchingEnvs, err := selector.Filter(
						c.Request.Context(),
						&rule.EnvironmentProgression.DependsOnEnvironmentSelector,
						envsList,
					)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{
							"error": err.Error(),
						})
						return
					}
					for _, env := range matchingEnvs {
						envs = append(envs, env.Id)
					}
				}
			}

			policiesMap[policy.Id] = &oapi.ResolvedPolicy{
				Policy:         *policy,
				EnvironmentIds: envs,
				ReleaseTargets: []oapi.ReleaseTarget{*releaseTarget},
			}
		}
	}

	policies := make([]*oapi.ResolvedPolicy, 0, len(policiesMap))
	for _, policy := range policiesMap {
		policies = append(policies, policy)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": policies,
	})
}
