package resources

import (
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/resources"
)

type Resources struct{}

var resourceTracer = otel.Tracer("server/openapi/resources")

func (r *Resources) QueryResources(
	c *gin.Context,
	workspaceId string,
	params oapi.QueryResourcesParams,
) {
	var body oapi.QueryResourcesJSONBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	resourcesGetter := resources.PostgresGetResources{}
	cel := body.Filter
	if cel == "" {
		cel = "true"
	}
	resources, err := resourcesGetter.GetResources(
		c.Request.Context(),
		workspaceId,
		resources.GetResourcesOptions{
			CEL: cel,
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get resources: " + err.Error(),
		})
		return
	}

	sort.Slice(resources, func(i, j int) bool {
		if resources[i].Name == resources[j].Name {
			return resources[i].CreatedAt.Before(resources[j].CreatedAt)
		}
		return resources[i].Name < resources[j].Name
	})

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}

	total := len(resources)

	start := min(offset, total)
	end := min(start+limit, total)
	paginatedResources := resources[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedResources,
	})
}

type computeAggregateBody struct {
	Filter  string `json:"filter"`
	GroupBy []struct {
		Name     string `json:"name"`
		Property string `json:"property"`
	} `json:"groupBy"`
}

func (r *Resources) ComputeAggergate(
	c *gin.Context,
	workspaceId string,
) {
	ctx := c.Request.Context()
	_, span := resourceTracer.Start(ctx, "Resources.ComputeAggregate")
	defer span.End()

	var body computeAggregateBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	groupBy := make([]Grouping, len(body.GroupBy))
	for i, g := range body.GroupBy {
		groupBy[i] = Grouping{Name: g.Name, Property: g.Property}
	}

	result, err := ComputeAggregate(
		ctx,
		&resources.PostgresGetResources{},
		workspaceId,
		AggregateRequest{
			Filter:  body.Filter,
			GroupBy: groupBy,
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to compute aggregate: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
