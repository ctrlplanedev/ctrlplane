package release_targets

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

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
