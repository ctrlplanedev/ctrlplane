package workflows

import (
	"fmt"
	"net/http"

	"workspace-engine/pkg/oapi"

	"github.com/gin-gonic/gin"
)

type Workflows struct {
	getter Getter
	setter Setter
}

func NewWorkflows() Workflows {
	return Workflows{getter: &PostgresGetter{}}
}

func getInputs(c *gin.Context) (map[string]any, error) {
	var body oapi.CreateWorkflowRunJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		return nil, fmt.Errorf("invalid request body: %w", err)
	}
	return body.Inputs, nil
}

func resolveInputs(workflow *oapi.Workflow, provided map[string]any) (map[string]any, error) {
	resolved := make(map[string]any, len(provided))
	for k, v := range provided {
		resolved[k] = v
	}

	for _, input := range workflow.Inputs {
		if s, err := input.AsWorkflowStringInput(); err == nil {
			if _, ok := resolved[s.Key]; !ok && s.Default != nil {
				resolved[s.Key] = *s.Default
			}
			continue
		}
		if n, err := input.AsWorkflowNumberInput(); err == nil {
			if _, ok := resolved[n.Key]; !ok && n.Default != nil {
				resolved[n.Key] = *n.Default
			}
			continue
		}
		if b, err := input.AsWorkflowBooleanInput(); err == nil {
			if _, ok := resolved[b.Key]; !ok && b.Default != nil {
				resolved[b.Key] = *b.Default
			}
			continue
		}
		if o, err := input.AsWorkflowObjectInput(); err == nil {
			if _, ok := resolved[o.Key]; !ok && o.Default != nil {
				resolved[o.Key] = *o.Default
			}
			continue
		}
		if a, err := input.AsWorkflowArrayInput(); err == nil {
			_ = a
			continue
		}
		return nil, fmt.Errorf("unrecognized workflow input type")
	}

	return resolved, nil
}

func (w *Workflows) CreateWorkflowRun(
	c *gin.Context,
	workspaceId string,
	workflowId string,
) {
	workflow, err := w.getter.GetWorkflowByID(c.Request.Context(), workflowId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	provided, err := getInputs(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inputs, err := resolveInputs(workflow, provided)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := w.setter.CreateWorkflowRun(c.Request.Context(), workspaceId, workflow, inputs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Workflow run created"})
}
