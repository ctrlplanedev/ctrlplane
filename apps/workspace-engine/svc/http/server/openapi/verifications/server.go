package verifications

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Verifications struct {
	getter Getter
}

func New() Verifications {
	return Verifications{getter: &PostgresGetter{}}
}

func (v *Verifications) GetJobVerificationStatus(c *gin.Context, jobId string) {
	status, err := v.getter.GetJobVerificationStatus(c.Request.Context(), jobId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": status})
}
