package deployments

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
)

type Deployments struct {
	getter Getter
}

func New() Deployments {
	return Deployments{getter: &PostgresGetter{}}
}

func (d *Deployments) ListDeployments(
	c *gin.Context,
	workspaceId string,
	params oapi.ListDeploymentsParams,
) {
	ctx := c.Request.Context()

	workspaceUUID, err := uuid.Parse(workspaceId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	allDeployments, err := d.getter.GetAllDeploymentsByWorkspaceID(ctx, workspaceUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list deployments"})
		return
	}

	filtered := allDeployments
	if params.Cel != nil && *params.Cel != "" {
		cel := *params.Cel
		filtered = make([]db.Deployment, 0, len(allDeployments))
		for _, dep := range allDeployments {
			oapiDep := db.ToOapiDeployment(dep)
			matched, err := selector.Match(ctx, cel, oapiDep)
			if err != nil {
				c.JSON(
					http.StatusBadRequest,
					gin.H{"error": "Invalid CEL expression: " + err.Error()},
				)
				return
			}
			if matched {
				filtered = append(filtered, dep)
			}
		}
	}

	total := len(filtered)

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	if offset > len(filtered) {
		offset = len(filtered)
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	page := filtered[offset:end]

	deploymentIDs := make([]uuid.UUID, len(page))
	for i, dep := range page {
		deploymentIDs[i] = dep.ID
	}

	systemsByDepID, err := d.getter.GetSystemsByDeploymentIDs(ctx, deploymentIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get systems"})
		return
	}

	items := make([]gin.H, len(page))
	for i, dep := range page {
		oapiDep := db.ToOapiDeployment(dep)

		systems := systemsByDepID[dep.ID]
		oapiSystems := make([]oapi.System, len(systems))
		for j, sys := range systems {
			oapiSystems[j] = *db.ToOapiSystem(sys)
		}

		items[i] = gin.H{
			"deployment": oapiDep,
			"systems":    oapiSystems,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (d *Deployments) GetJobAgentsForDeployment(c *gin.Context, deploymentId string) {
	ctx := c.Request.Context()
	queries := db.GetQueries(ctx)

	deploymentUUID, err := uuid.Parse(deploymentId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid deployment ID"})
		return
	}

	deployment, err := queries.GetDeploymentByID(ctx, deploymentUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get deployment"})
		return
	}

	allAgents, err := queries.ListJobAgentsByWorkspaceID(ctx, deployment.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list job agents"})
		return
	}

	oapiAgents := make([]oapi.JobAgent, len(allAgents))
	for i, row := range allAgents {
		oapiAgents[i] = *db.ToOapiJobAgent(row)
	}

	releaseTargets, err := queries.GetReleaseTargetsForDeployment(ctx, deploymentUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get release targets"})
		return
	}

	agentSet := make(map[string]oapi.JobAgent)

	for _, rt := range releaseTargets {
		resourceRow, err := queries.GetResourceByID(ctx, rt.ResourceID)
		if err != nil {
			continue
		}
		resource := db.ToOapiResource(resourceRow)

		agents, err := selector.MatchJobAgentsWithResource(
			ctx,
			deployment.JobAgentSelector,
			oapiAgents,
			resource,
		)
		if err != nil {
			c.JSON(
				http.StatusBadRequest,
				gin.H{"error": "Failed to evaluate selector: " + err.Error()},
			)
			return
		}

		for _, agent := range agents {
			agentSet[agent.Id] = agent
		}
	}

	matched := make([]oapi.JobAgent, 0, len(agentSet))
	for _, agent := range agentSet {
		matched = append(matched, agent)
	}

	c.JSON(http.StatusOK, gin.H{"items": matched})
}
