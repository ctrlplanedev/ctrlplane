package workflows

import (
	"fmt"
	"maps"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile/postgres"
)

// resourceSelectorInputKey is the reserved input key whose value is a CEL
// expression selecting the resources a run fans out over. One set of jobs is
// dispatched per matched resource. Absent or empty means a single, non-fanned-
// out run.
const resourceSelectorInputKey = "resourceSelector"

type Workflows struct {
	getter Getter
	setter Setter
}

func NewWorkflows(pool *pgxpool.Pool) Workflows {
	queue := postgres.New(pool)
	return Workflows{
		getter: &PostgresGetter{},
		setter: NewPostgresSetter(queue),
	}
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
	maps.Copy(resolved, provided)

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
	ctx := c.Request.Context()

	workflow, err := w.getter.GetWorkflowByID(ctx, workflowId)
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

	resourceSelector := ""
	if raw, ok := inputs[resourceSelectorInputKey]; ok {
		sel, isString := raw.(string)
		if !isString {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("%s must be a string", resourceSelectorInputKey),
			})
			return
		}
		resourceSelector = sel
	}
	resources, err := w.getter.GetResourcesMatching(ctx, workspaceId, resourceSelector)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	runners, err := w.getter.GetJobAgentsByRef(ctx, workspaceId, workflow.Jobs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dispatches, err := planDispatches(
		ctx,
		buildDispatchContext(workflow, inputs),
		resources,
		workflow.Jobs,
		runners,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result, err := w.setter.PersistWorkflowRun(ctx, workspaceId, workflow.Id, inputs, dispatches)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
