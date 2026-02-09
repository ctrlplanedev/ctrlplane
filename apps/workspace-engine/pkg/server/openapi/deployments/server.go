package deployments

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var deploymentTracer = otel.Tracer("workspace-engine/deployments")

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
	ctx := c.Request.Context()
	ctx, span := deploymentTracer.Start(ctx, "GetReleaseTargetsForDeployment")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("deployment.id", deploymentId),
	)
	defer span.End()

	// Apply a request-scoped timeout to prevent unbounded execution
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	c.Request = c.Request.WithContext(ctx)

	// Phase 1: Get workspace
	_, wsSpan := deploymentTracer.Start(ctx, "GetWorkspace")
	ws, err := utils.GetWorkspace(c, workspaceId)
	wsSpan.End()
	if err != nil {
		errMsg := "Failed to get workspace: " + err.Error()
		span.RecordError(err)
		span.SetStatus(codes.Error, errMsg)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
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

	span.SetAttributes(
		attribute.Int("params.limit", limit),
		attribute.Int("params.offset", offset),
	)
	if params.Query != nil {
		span.SetAttributes(attribute.String("params.query", *params.Query))
	}

	// Phase 2: List release targets for deployment
	_, listSpan := deploymentTracer.Start(ctx, "ListReleaseTargetsForDeployment")
	releaseTargetsList, err := getReleaseTargetsForDeployment(c, ws, deploymentId, params.Query)
	listSpan.SetAttributes(attribute.Int("release_targets.count", len(releaseTargetsList)))
	listSpan.End()
	if err != nil {
		errMsg := "Failed to list release targets: " + err.Error()
		span.RecordError(err)
		span.SetStatus(codes.Error, errMsg)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}

	sort.Slice(releaseTargetsList, func(i, j int) bool {
		return releaseTargetsList[i].Key() < releaseTargetsList[j].Key()
	})

	total := len(releaseTargetsList)
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedTargets := releaseTargetsList[start:end]

	span.SetAttributes(
		attribute.Int("release_targets.total", total),
		attribute.Int("release_targets.paginated_count", len(paginatedTargets)),
	)

	// Phase 3: Compute state for each release target
	// Relationships are already pre-computed in the store at boot time.
	// PlanDeployment reads them from the store on cache miss — no need to
	// pre-fetch here.
	_, stateSpan := deploymentTracer.Start(ctx, "ComputeReleaseTargetStates")

	type result struct {
		item *oapi.ReleaseTargetWithState
		err  error
	}
	results, err := concurrency.ProcessInChunks(
		ctx,
		paginatedTargets,
		func(chunkCtx context.Context, releaseTarget *oapi.ReleaseTarget) (result, error) {
			if releaseTarget == nil {
				return result{nil, fmt.Errorf("release target is nil")}, nil
			}

			state, err := ws.ReleaseManager().GetReleaseTargetState(
				chunkCtx,
				releaseTarget,
			)
			if err != nil {
				return result{nil, fmt.Errorf("error getting state for key=%s: %w", releaseTarget.Key(), err)}, nil
			}

			environment, ok := ws.Environments().Get(releaseTarget.EnvironmentId)
			if !ok {
				return result{nil, fmt.Errorf("environment not found: environmentId=%s for key=%s", releaseTarget.EnvironmentId, releaseTarget.Key())}, nil
			}

			resource, ok := ws.Resources().Get(releaseTarget.ResourceId)
			if !ok {
				return result{nil, fmt.Errorf("resource not found: resourceId=%s for key=%s", releaseTarget.ResourceId, releaseTarget.Key())}, nil
			}

			deployment, ok := ws.Deployments().Get(releaseTarget.DeploymentId)
			if !ok {
				return result{nil, fmt.Errorf("deployment not found: deploymentId=%s for key=%s", releaseTarget.DeploymentId, releaseTarget.Key())}, nil
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

	stateSpan.End()

	if err != nil {
		errMsg := "Failed to compute release target states: " + err.Error()
		span.RecordError(err)
		span.SetStatus(codes.Error, errMsg)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}

	releaseTargetsWithState := make([]*oapi.ReleaseTargetWithState, 0, end-start)
	skipped := 0
	for _, r := range results {
		if r.err != nil {
			skipped++
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

	span.SetAttributes(
		attribute.Int("results.returned", len(releaseTargetsWithState)),
		attribute.Int("results.skipped", skipped),
	)

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
