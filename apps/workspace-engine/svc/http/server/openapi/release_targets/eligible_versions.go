package release_targets

import (
	"iter"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/cel-go/cel"
	"github.com/google/uuid"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/svc/controllers/desiredrelease"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
)

// filterVersionsByCEL wraps a candidate-version iterator with a CEL predicate
// so policy evaluation only runs on versions the user is actually searching
// for. Per-version eval errors (post-Compile runtime issues) skip silently —
// malformed expressions are caught at compile time before this is called.
func filterVersionsByCEL(
	in iter.Seq2[*oapi.DeploymentVersion, error],
	prg cel.Program,
) iter.Seq2[*oapi.DeploymentVersion, error] {
	return func(yield func(*oapi.DeploymentVersion, error) bool) {
		for v, err := range in {
			if err != nil {
				if !yield(nil, err) {
					return
				}
				continue
			}
			vMap, mapErr := celutil.EntityToMap(v)
			if mapErr != nil {
				if !yield(nil, mapErr) {
					return
				}
				continue
			}
			ok, evalErr := celutil.EvalBool(prg, map[string]any{"version": vMap})
			if evalErr != nil || !ok {
				continue
			}
			if !yield(v, nil) {
				return
			}
		}
	}
}

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
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "failed to build CEL env: " + err.Error()},
		)
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
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "check release target exists: " + err.Error()},
		)
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "release target not found"})
		return
	}

	scope, err := getter.GetReleaseTargetScope(ctx, drt)
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "get release target scope: " + err.Error()},
		)
		return
	}

	oapiRT := drt.ToOAPI()
	rtPolicies, err := getter.GetPoliciesForReleaseTarget(ctx, oapiRT)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get policies: " + err.Error()})
		return
	}

	evals := policyeval.CollectEvaluators(ctx, getter, oapiRT, rtPolicies)
	versions := filterVersionsByCEL(
		getter.IterCandidateVersions(ctx, drt.DeploymentID, nil, nil),
		prg,
	)

	filtered, err := policyeval.ListDeployableVersions(ctx, getter, oapiRT, versions, evals, *scope)
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "list deployable versions: " + err.Error()},
		)
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
	if limit < 0 || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "limit and offset must be non-negative"})
		return
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
