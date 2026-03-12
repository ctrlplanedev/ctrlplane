package resources

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/cel-go/cel"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	storeresources "workspace-engine/pkg/store/resources"
)

// AggregateRequest is the parsed input for computing a resource aggregate.
type AggregateRequest struct {
	Filter  string
	GroupBy []Grouping
}

// Grouping defines a single grouping dimension.
type Grouping struct {
	Name     string
	Property string
}

// AggregateResult is the output of a compute aggregate operation.
type AggregateResult struct {
	Total  int              `json:"total"`
	Groups []AggregateGroup `json:"groups"`
}

// AggregateGroup is a single bucket in the aggregate result.
type AggregateGroup struct {
	Key   map[string]string `json:"key"`
	Count int               `json:"count"`
}

var aggregateCelEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

func evalPropertyToString(prg cel.Program, resourceMap map[string]any) string {
	val, _, err := prg.Eval(map[string]any{"resource": resourceMap})
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%v", val.Value())
}

// ComputeAggregateFromResources groups a slice of resources by the given
// groupings and returns the aggregate result. This is a pure function with
// no I/O, suitable for unit testing.
func ComputeAggregateFromResources(
	matched []*oapi.Resource,
	groupBy []Grouping,
) AggregateResult {
	if len(groupBy) == 0 {
		return AggregateResult{
			Total:  len(matched),
			Groups: []AggregateGroup{},
		}
	}

	groupNames := make([]string, len(groupBy))
	groupPrograms := make([]cel.Program, len(groupBy))
	for i, g := range groupBy {
		groupNames[i] = g.Name
		prg, err := aggregateCelEnv.Compile(g.Property)
		if err == nil {
			groupPrograms[i] = prg
		}
	}

	buckets := map[string]*AggregateGroup{}
	var orderedKeys []string

	for _, res := range matched {
		resMap, err := celutil.EntityToMap(res)
		if err != nil {
			continue
		}

		key := make(map[string]string, len(groupNames))
		var keyParts []string
		for i, name := range groupNames {
			val := ""
			if groupPrograms[i] != nil {
				val = evalPropertyToString(groupPrograms[i], resMap)
			}
			key[name] = val
			keyParts = append(keyParts, name+"="+val)
		}
		bucketKey := strings.Join(keyParts, "\x00")

		if existing, ok := buckets[bucketKey]; ok {
			existing.Count++
		} else {
			buckets[bucketKey] = &AggregateGroup{Key: key, Count: 1}
			orderedKeys = append(orderedKeys, bucketKey)
		}
	}

	sort.Slice(orderedKeys, func(i, j int) bool {
		return buckets[orderedKeys[i]].Count > buckets[orderedKeys[j]].Count
	})

	groups := make([]AggregateGroup, 0, len(orderedKeys))
	for _, k := range orderedKeys {
		groups = append(groups, *buckets[k])
	}

	return AggregateResult{
		Total:  len(matched),
		Groups: groups,
	}
}

// ComputeAggregate fetches resources via the provided getter, then groups
// them according to the request. This is the testable orchestration layer.
func ComputeAggregate(
	ctx context.Context,
	getter storeresources.GetResources,
	workspaceId string,
	req AggregateRequest,
) (*AggregateResult, error) {
	filterExpr := "true"
	if req.Filter != "" {
		filterExpr = req.Filter
	}

	matched, err := getter.GetResources(ctx, workspaceId, storeresources.GetResourcesOptions{
		CEL: filterExpr,
	})
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	result := ComputeAggregateFromResources(matched, req.GroupBy)
	return &result, nil
}
