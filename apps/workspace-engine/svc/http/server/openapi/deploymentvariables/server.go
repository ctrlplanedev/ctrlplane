package deploymentvariables

import (
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/http/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type DeploymentVariables struct {
}

func (s *DeploymentVariables) GetDeploymentVariable(c *gin.Context, workspaceId string, variableId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	variable, ok := ws.DeploymentVariables().Get(variableId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment variable not found",
		})
		return
	}

	valuesMap := ws.DeploymentVariables().Values(variableId)
	values := make([]oapi.DeploymentVariableValue, 0, len(valuesMap))
	for _, v := range valuesMap {
		if v != nil {
			values = append(values, *v)
		}
	}

	c.JSON(http.StatusOK, oapi.DeploymentVariableWithValues{
		Variable: *variable,
		Values:   values,
	})
}

func (s *DeploymentVariables) GetDeploymentVariableValue(c *gin.Context, workspaceId string, valueId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	value, ok := ws.DeploymentVariableValues().Get(valueId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Deployment variable value not found",
		})
		return
	}

	c.JSON(http.StatusOK, value)
}
