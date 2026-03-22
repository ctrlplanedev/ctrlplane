package workflows

import (
	"fmt"
	"net/http"

	"workspace-engine/pkg/oapi"

	"github.com/gin-gonic/gin"
)

type Workflows struct{}

func getInputs(c *gin.Context) (map[string]any, error) {
	var body oapi.CreateWorkflowRunJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		return nil, fmt.Errorf("invalid request body: %w", err)
	}
	return body.Inputs, nil
}

func buildDispatchContext(inputs map[string]any) map[string]any {
	return map[string]any{
		"inputs": inputs,
	}
}

func (w *Workflows) CreateWorkflowRun(
	c *gin.Context,
	workspaceId string,
	workflowId string,
) {
	req, err := extractCreateWorkflowRunRequest(c, workspaceId, workflowId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = req
}
