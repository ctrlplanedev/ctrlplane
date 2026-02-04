package workflows

import (
	"net/http"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"

	"github.com/gin-gonic/gin"
)

type Workflows struct{}

func (w *Workflows) GetWorkflowTemplates(c *gin.Context, workspaceId string, params oapi.GetWorkflowTemplatesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get workspace: " + err.Error(),
		})
		return
	}

	workflowTemplates := ws.WorkflowTemplates().Items()
	workflowTemplateItems := make([]*oapi.WorkflowTemplate, 0, len(workflowTemplates))
	for _, workflowTemplate := range workflowTemplates {
		workflowTemplateItems = append(workflowTemplateItems, workflowTemplate)
	}
	sort.Slice(workflowTemplateItems, func(i, j int) bool {
		return workflowTemplateItems[i].Name < workflowTemplateItems[j].Name
	})

	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}

	total := len(workflowTemplateItems)
	start := min(offset, total)
	end := min(start+limit, total)

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  workflowTemplateItems[start:end],
	})
}
