package release_targets

import (
	"errors"
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
	return oapi.ReleaseTarget{
		ResourceId:    key[:uuidLen],
		EnvironmentId: key[uuidLen+1 : uuidLen*2+1],
		DeploymentId:  key[uuidLen*2+2:],
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

		state.LatestJob = &oapi.JobWithVerifications{
			Job:           *latestJob,
			Verifications: verifications,
		}
	}

	c.JSON(http.StatusOK, state)
}
