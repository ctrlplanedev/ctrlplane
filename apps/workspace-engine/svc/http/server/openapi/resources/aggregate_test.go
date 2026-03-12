package resources

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	storeresources "workspace-engine/pkg/store/resources"
)

func makeResource(name, kind string, metadata map[string]string) *oapi.Resource {
	return &oapi.Resource{
		Id:          "id-" + name,
		Name:        name,
		Kind:        kind,
		Identifier:  "id-" + name,
		Version:     "v1",
		WorkspaceId: "ws-1",
		Config:      map[string]any{},
		Metadata:    metadata,
		CreatedAt:   time.Now(),
	}
}

func TestComputeAggregateFromResources_NoGroupBy(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", nil),
		makeResource("b", "server", nil),
	}

	result := ComputeAggregateFromResources(resources, nil)
	assert.Equal(t, 2, result.Total)
	assert.Empty(t, result.Groups)
}

func TestComputeAggregateFromResources_GroupByKind(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", nil),
		makeResource("b", "server", nil),
		makeResource("c", "database", nil),
	}

	result := ComputeAggregateFromResources(resources, []Grouping{
		{Name: "type", Property: "resource.kind"},
	})

	assert.Equal(t, 3, result.Total)
	require.Len(t, result.Groups, 2)
	assert.Equal(t, "server", result.Groups[0].Key["type"])
	assert.Equal(t, 2, result.Groups[0].Count)
	assert.Equal(t, "database", result.Groups[1].Key["type"])
	assert.Equal(t, 1, result.Groups[1].Count)
}

func TestComputeAggregateFromResources_GroupByMetadata(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", map[string]string{"region": "us-east-1"}),
		makeResource("b", "server", map[string]string{"region": "us-east-1"}),
		makeResource("c", "server", map[string]string{"region": "eu-west-1"}),
		makeResource("d", "server", map[string]string{}),
	}

	result := ComputeAggregateFromResources(resources, []Grouping{
		{Name: "region", Property: "resource.metadata['region']"},
	})

	assert.Equal(t, 4, result.Total)
	require.Len(t, result.Groups, 3)
	assert.Equal(t, "us-east-1", result.Groups[0].Key["region"])
	assert.Equal(t, 2, result.Groups[0].Count)
}

func TestComputeAggregateFromResources_MultipleGroupBy(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", map[string]string{"region": "us-east-1"}),
		makeResource("b", "server", map[string]string{"region": "us-east-1"}),
		makeResource("c", "database", map[string]string{"region": "us-east-1"}),
		makeResource("d", "server", map[string]string{"region": "eu-west-1"}),
	}

	result := ComputeAggregateFromResources(resources, []Grouping{
		{Name: "type", Property: "resource.kind"},
		{Name: "region", Property: "resource.metadata['region']"},
	})

	assert.Equal(t, 4, result.Total)
	require.Len(t, result.Groups, 3)
	assert.Equal(t, 2, result.Groups[0].Count)
	assert.Equal(t, "server", result.Groups[0].Key["type"])
	assert.Equal(t, "us-east-1", result.Groups[0].Key["region"])
}

func TestComputeAggregateFromResources_InvalidCelProperty(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", nil),
		makeResource("b", "database", nil),
	}

	result := ComputeAggregateFromResources(resources, []Grouping{
		{Name: "bad", Property: "this is not valid cel !!!"},
	})

	assert.Equal(t, 2, result.Total)
	require.Len(t, result.Groups, 1)
	assert.Empty(t, result.Groups[0].Key["bad"])
	assert.Equal(t, 2, result.Groups[0].Count)
}

func TestComputeAggregateFromResources_EmptyResources(t *testing.T) {
	result := ComputeAggregateFromResources(nil, []Grouping{
		{Name: "type", Property: "resource.kind"},
	})

	assert.Equal(t, 0, result.Total)
	assert.Empty(t, result.Groups)
}

func TestComputeAggregateFromResources_SortedByCountDescending(t *testing.T) {
	resources := []*oapi.Resource{
		makeResource("a", "server", nil),
		makeResource("b", "database", nil),
		makeResource("c", "database", nil),
		makeResource("d", "database", nil),
		makeResource("e", "cache", nil),
		makeResource("f", "cache", nil),
	}

	result := ComputeAggregateFromResources(resources, []Grouping{
		{Name: "type", Property: "resource.kind"},
	})

	require.Len(t, result.Groups, 3)
	assert.Equal(t, 3, result.Groups[0].Count)
	assert.Equal(t, "database", result.Groups[0].Key["type"])
	assert.Equal(t, 2, result.Groups[1].Count)
	assert.Equal(t, "cache", result.Groups[1].Key["type"])
	assert.Equal(t, 1, result.Groups[2].Count)
	assert.Equal(t, "server", result.Groups[2].Key["type"])
}

type mockGetResources struct {
	resources []*oapi.Resource
	err       error
}

func (m *mockGetResources) GetResources(
	_ context.Context,
	_ string,
	_ storeresources.GetResourcesOptions,
) ([]*oapi.Resource, error) {
	return m.resources, m.err
}

func TestComputeAggregate_WithMockGetter(t *testing.T) {
	mock := &mockGetResources{
		resources: []*oapi.Resource{
			makeResource("a", "server", map[string]string{"env": "prod"}),
			makeResource("b", "server", map[string]string{"env": "prod"}),
			makeResource("c", "server", map[string]string{"env": "staging"}),
		},
	}

	result, err := ComputeAggregate(context.Background(), mock, "ws-1", AggregateRequest{
		Filter: "true",
		GroupBy: []Grouping{
			{Name: "environment", Property: "resource.metadata['env']"},
		},
	})

	require.NoError(t, err)
	assert.Equal(t, 3, result.Total)
	require.Len(t, result.Groups, 2)
	assert.Equal(t, "prod", result.Groups[0].Key["environment"])
	assert.Equal(t, 2, result.Groups[0].Count)
}

func TestComputeAggregate_GetterError(t *testing.T) {
	mock := &mockGetResources{
		err: assert.AnError,
	}

	result, err := ComputeAggregate(context.Background(), mock, "ws-1", AggregateRequest{
		Filter: "true",
	})

	require.Error(t, err)
	assert.Nil(t, result)
}
