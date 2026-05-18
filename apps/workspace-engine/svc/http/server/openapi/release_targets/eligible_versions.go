package release_targets

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
)

func (rt *ReleaseTargets) ListEligibleVersionsForReleaseTarget(
	c *gin.Context,
	workspaceId string,
	releaseTargetKey string,
	params oapi.ListEligibleVersionsForReleaseTargetParams,
) {
	ctx := c.Request.Context()

	target, err := parseReleaseTargetKey(releaseTargetKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace id: " + err.Error()})
		return
	}

	var body oapi.ListEligibleVersionsForReleaseTargetJSONBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	filter := "true"
	if body.Filter != nil && *body.Filter != "" {
		filter = *body.Filter
	}

	celEnv, err := celutil.NewEnvBuilder().
		WithMapVariables("version").
		WithStandardExtensions().
		BuildCached(12 * time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build CEL env: " + err.Error()})
		return
	}
	if err := celEnv.Validate(filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filter expression: " + err.Error()})
		return
	}
	prg, err := celEnv.Compile(filter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filter expression: " + err.Error()})
		return
	}

	drt := &desiredrelease.ReleaseTarget{WorkspaceID: workspaceUUID}
	if err := drt.FromOapi(&target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	getter := desiredrelease.NewPostgresGetter(
		db.GetQueries(ctx),
		releasetargets.NewGetReleaseTargetsForDeployment(),
		releasetargets.NewGetReleaseTargetsForDeploymentAndEnvironment(),
		policies.NewPostgresGetPoliciesForReleaseTarget(),
		releasetargets.NewGetJobsForReleaseTarget(),
	)

	exists, err := getter.ReleaseTargetExists(ctx, drt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "check release target exists: " + err.Error()})
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "release target not found"})
		return
	}

	scope, err := getter.GetReleaseTargetScope(ctx, drt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get release target scope: " + err.Error()})
		return
	}

	oapiRT := drt.ToOAPI()
	rtPolicies, err := getter.GetPoliciesForReleaseTarget(ctx, oapiRT)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get policies: " + err.Error()})
		return
	}

	evals := policyeval.CollectEvaluators(ctx, getter, oapiRT, rtPolicies)
	versions := getter.IterCandidateVersions(ctx, drt.DeploymentID, nil, nil)

	eligible, err := policyeval.ListDeployableVersions(ctx, getter, oapiRT, versions, evals, *scope)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list deployable versions: " + err.Error()})
		return
	}

	filtered := make([]*oapi.DeploymentVersion, 0, len(eligible))
	for _, v := range eligible {
		vMap, err := celutil.EntityToMap(v)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "convert version: " + err.Error()})
			return
		}
		ok, err := celutil.EvalBool(prg, map[string]any{"version": vMap})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "evaluate filter: " + err.Error()})
			return
		}
		if ok {
			filtered = append(filtered, v)
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

	total := len(filtered)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"items":  filtered[start:end],
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
