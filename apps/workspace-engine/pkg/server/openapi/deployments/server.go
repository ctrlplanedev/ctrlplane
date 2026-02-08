package deployments

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/releasemanager"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

func getReleaseTargetsForDeployment(_ *gin.Context, ws *workspace.Workspace, deploymentId string, resourceName *string) ([]*oapi.ReleaseTarget, error) {
	releaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		return nil, err
	}
	// Build list of release targets for this deployment, filtering out any nils
	releaseTargetsList := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.DeploymentId == deploymentId {
			if resourceName == nil {
				releaseTargetsList = append(releaseTargetsList, releaseTarget)
				continue
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				continue
			}
			if !strings.Contains(strings.ToLower(resource.Name), strings.ToLower(*resourceName)) {
				continue
			}
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}

	return releaseTargetsList, nil
}

// precomputeResourceRelationships pre-computes relationships for unique resources
// in the paginated targets to avoid redundant GetRelatedEntities calls during
// PlanDeployment (which is called on cache miss in GetReleaseTargetState).
func precomputeResourceRelationships(ctx context.Context, ws *workspace.Workspace, targets []*oapi.ReleaseTarget) map[string]map[string][]*oapi.EntityRelation {
	uniqueResourceIds := make(map[string]bool, len(targets))
	for _, target := range targets {
		if target != nil {
			uniqueResourceIds[target.ResourceId] = true
		}
	}

	result := make(map[string]map[string][]*oapi.EntityRelation, len(uniqueResourceIds))
	for resourceId := range uniqueResourceIds {
		resource, exists := ws.Resources().Get(resourceId)
		if !exists {
			log.Warn("Resource not found during relationship pre-computation", "resourceId", resourceId)
			continue
		}

		entity := relationships.NewResourceEntity(resource)
		relatedEntities, err := ws.RelationshipRules().GetRelatedEntities(ctx, entity)
		if err != nil {
			log.Warn("Failed to pre-compute relationships for resource",
				"resourceId", resourceId,
				"error", err.Error())
			continue
		}

		result[resourceId] = relatedEntities
	}

	log.Debug("Pre-computed resource relationships",
		"uniqueResources", len(uniqueResourceIds),
		"computed", len(result))

	return result
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

	// Build index of variable values by deployment variable ID for O(1) lookups
	valuesByVariableId := make(map[string][]oapi.DeploymentVariableValue)
	for _, value := range ws.DeploymentVariableValues().Items() {
		if value != nil {
			valuesByVariableId[value.DeploymentVariableId] = append(
				valuesByVariableId[value.DeploymentVariableId],
				*value,
			)
		}
	}

	// Collect variables for this deployment
	variables := make([]oapi.DeploymentVariableWithValues, 0)
	for _, variable := range ws.DeploymentVariables().Items() {
		if variable != nil && variable.DeploymentId == deploymentId {
			values := valuesByVariableId[variable.Id]
			if values == nil {
				values = make([]oapi.DeploymentVariableValue, 0)
			}
			variables = append(variables, oapi.DeploymentVariableWithValues{
				Variable: *variable,
				Values:   values,
			})
		}
	}

	deploymentWithVariables := &oapi.DeploymentWithVariables{
		Deployment: *deployment,
		Variables:  variables,
	}

	c.JSON(http.StatusOK, deploymentWithVariables)
}

func (s *Deployments) GetDeploymentResources(c *gin.Context, workspaceId string, deploymentId string, params oapi.GetDeploymentResourcesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	resources, err := ws.Deployments().Resources(c.Request.Context(), deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Sort the resourceList by resource.Name (nil-safe, ascending); if Name is the same, sort by CreatedAt
	sort.Slice(resources, func(i, j int) bool {
		if resources[i] == nil && resources[j] == nil {
			return false
		}
		if resources[i] == nil {
			return false
		}
		if resources[j] == nil {
			return true
		}
		if resources[i].Name < resources[j].Name {
			return true
		}
		if resources[i].Name > resources[j].Name {
			return false
		}
		// Names are equal; compare CreatedAt
		return resources[i].CreatedAt.Before(resources[j].CreatedAt)
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

	total := len(resources)

	// Apply pagination
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := resources[start:end]

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
			log.Error("System not found for deployment", "deploymentId", deployment.Id, "systemId", deployment.SystemId)
			continue
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
		log.Error("Failed to get workspace for release targets",
			"workspaceId", workspaceId,
			"deploymentId", deploymentId,
			"error", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
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

	log.Info("Getting release targets for deployment", "deploymentId", deploymentId, "query", params.Query)

	releaseTargetsList, err := getReleaseTargetsForDeployment(c, ws, deploymentId, params.Query)
	if err != nil {
		log.Error("Failed to list release targets for deployment",
			"workspaceId", workspaceId,
			"deploymentId", deploymentId,
			"error", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list release targets: " + err.Error(),
		})
		return
	}

	sort.Slice(releaseTargetsList, func(i, j int) bool {
		return releaseTargetsList[i].Key() < releaseTargetsList[j].Key()
	})

	total := len(releaseTargetsList)
	start := min(offset, total)
	end := min(start+limit, total)

	paginatedTargets := releaseTargetsList[start:end]

	log.Debug("Processing release targets for deployment",
		"workspaceId", workspaceId,
		"deploymentId", deploymentId,
		"total", total,
		"paginatedCount", len(paginatedTargets),
		"offset", offset,
		"limit", limit)

	// Pre-compute resource relationships for unique resources to avoid redundant
	// GetRelatedEntities calls during PlanDeployment (called on cache miss in GetReleaseTargetState).
	resourceRelationships := precomputeResourceRelationships(c.Request.Context(), ws, paginatedTargets)

	releaseTargetsWithState := make([]*oapi.ReleaseTargetWithState, 0, end-start)

	type result struct {
		item *oapi.ReleaseTargetWithState
		err  error
	}
	results, err := concurrency.ProcessInChunks(
		c.Request.Context(),
		paginatedTargets,
		func(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (result, error) {
			if releaseTarget == nil {
				return result{nil, fmt.Errorf("release target is nil")}, nil
			}

			var stateOpts []releasemanager.Option
			if rels, ok := resourceRelationships[releaseTarget.ResourceId]; ok {
				stateOpts = append(stateOpts, releasemanager.WithResourceRelationships(rels))
			}

			state, err := ws.ReleaseManager().GetReleaseTargetState(
				ctx,
				releaseTarget,
				stateOpts...,
			)
			if err != nil {
				log.Warn("Failed to get release target state",
					"workspaceId", workspaceId,
					"deploymentId", deploymentId,
					"releaseTargetKey", releaseTarget.Key(),
					"error", err.Error())
				return result{nil, fmt.Errorf("error getting release target state for key=%s: %w", releaseTarget.Key(), err)}, nil
			}

			environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
			if !ok {
				return result{nil, fmt.Errorf("environment not found: environmentId=%s for release target key=%s", releaseTarget.EnvironmentId, releaseTarget.Key())}, nil
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				return result{nil, fmt.Errorf("resource not found: resourceId=%s for release target key=%s", releaseTarget.ResourceId, releaseTarget.Key())}, nil
			}

			deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
			if !ok {
				return result{nil, fmt.Errorf("deployment not found: deploymentId=%s for release target key=%s", releaseTarget.DeploymentId, releaseTarget.Key())}, nil
			}

			item := &oapi.ReleaseTargetWithState{
				ReleaseTarget: *releaseTarget,
				State:         *state,
				Environment:   *environment,
				Resource:      *resource,
				Deployment:    *deployment,
			}
			return result{item, nil}, nil
		},
	)

	if err != nil {
		log.Error("Failed to process release target states",
			"workspaceId", workspaceId,
			"deploymentId", deploymentId,
			"paginatedCount", len(paginatedTargets),
			"error", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to compute release target states: " + err.Error(),
		})
		return
	}

	for _, r := range results {
		if r.err != nil {
			log.Warn("Skipping invalid release target",
				"workspaceId", workspaceId,
				"deploymentId", deploymentId,
				"error", r.err.Error())
			continue
		}
		if r.item != nil {
			releaseTargetsWithState = append(releaseTargetsWithState, r.item)
		}
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

	releaseTargets, err := getReleaseTargetsForDeployment(c, ws, deploymentId, nil)
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
