package validators

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	celSelector "workspace-engine/pkg/selector/langs/cel"

	"github.com/gin-gonic/gin"
)

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

	_, err = celSelector.Compile(cel.Cel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"valid": false, "errors": []string{err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true, "errors": []string{}})
}
