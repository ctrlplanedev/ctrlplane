package validators

import (
	"net/http"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"

	"github.com/gin-gonic/gin"
)

var selectorEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource", "deployment", "environment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

type Validator struct{}

func (v *Validator) ValidateResourceSelector(c *gin.Context) {
	var req oapi.ValidateResourceSelectorJSONBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cel, err := req.ResourceSelector.AsCelSelector()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"valid": false, "errors": []string{err.Error()}})
		return
	}

	if cel.Cel == "" {
		c.JSON(http.StatusOK, gin.H{"valid": false, "errors": []string{"CEL is required"}})
		return
	}

	if err := selectorEnv.Validate(cel.Cel); err != nil {
		c.JSON(http.StatusOK, gin.H{"valid": false, "errors": []string{err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true, "errors": []string{}})
}
