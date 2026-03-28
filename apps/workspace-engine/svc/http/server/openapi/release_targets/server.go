package release_targets

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/oapi"
)

const uuidLen = 36

type ReleaseTargets struct {
	getter Getter
}

func New() ReleaseTargets {
	return ReleaseTargets{getter: &PostgresGetter{}}
}

func (rt *ReleaseTargets) ListReleaseTargets(c *gin.Context, deploymentId string) {
	items, err := rt.getter.ListReleaseTargets(c.Request.Context(), deploymentId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

func parseReleaseTargetKey(key string) (oapi.ReleaseTarget, error) {
	if len(key) != uuidLen*3+2 {
		return oapi.ReleaseTarget{}, errors.New("invalid release target key format")
	}
	if key[uuidLen] != '-' || key[uuidLen*2+1] != '-' {
		return oapi.ReleaseTarget{}, errors.New("invalid release target key separators")
	}

	resourceId := key[:uuidLen]
	environmentId := key[uuidLen+1 : uuidLen*2+1]
	deploymentId := key[uuidLen*2+2:]

	if _, err := uuid.Parse(resourceId); err != nil {
		return oapi.ReleaseTarget{}, fmt.Errorf("invalid resource id: %w", err)
	}
	if _, err := uuid.Parse(environmentId); err != nil {
		return oapi.ReleaseTarget{}, fmt.Errorf("invalid environment id: %w", err)
	}
	if _, err := uuid.Parse(deploymentId); err != nil {
		return oapi.ReleaseTarget{}, fmt.Errorf("invalid deployment id: %w", err)
	}

	return oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}, nil
}

func (rt *ReleaseTargets) GetReleaseTargetState(
	c *gin.Context,
	workspaceId string,
	releaseTargetKey string,
) {
	ctx := c.Request.Context()

	target, err := parseReleaseTargetKey(releaseTargetKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var state oapi.ReleaseTargetState

	desiredRelease, err := rt.getter.GetDesiredRelease(ctx, target)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	state.DesiredRelease = desiredRelease

	currentRelease, err := rt.getter.GetCurrentRelease(ctx, target)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	state.CurrentRelease = currentRelease

	latestJob, err := rt.getter.GetLatestJobWithMetadata(ctx, target)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if latestJob != nil {
		jobID, _ := uuid.Parse(latestJob.Id)
		verifications, err := rt.getter.GetJobVerifications(ctx, jobID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Build verifications with computed status since oapi.JobVerification
		// has a Status() method but no serializable Status field.
		verificationsWithStatus := make([]gin.H, len(verifications))
		for i, v := range verifications {
			verificationsWithStatus[i] = gin.H{
				"id":        v.Id,
				"jobId":     v.JobId,
				"metrics":   v.Metrics,
				"createdAt": v.CreatedAt,
				"status":    string(v.Status()),
			}
			if v.Message != nil {
				verificationsWithStatus[i]["message"] = *v.Message
			}
		}

		state.LatestJob = &oapi.JobWithVerifications{
			Job:           *latestJob,
			Verifications: verifications,
		}

		c.JSON(http.StatusOK, gin.H{
			"desiredRelease": state.DesiredRelease,
			"currentRelease": state.CurrentRelease,
			"latestJob": gin.H{
				"job":           state.LatestJob.Job,
				"verifications": verificationsWithStatus,
			},
		})
		return
	}

	c.JSON(http.StatusOK, state)
}
