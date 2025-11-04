package relationgraph

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/oapi"
)

// BenchmarkBuilder_Sequential benchmarks sequential processing
func BenchmarkBuilder_Sequential(b *testing.B) {
	resources := make(map[string]*oapi.Resource)
	deployments := make(map[string]*oapi.Deployment)

	// Create 200 resources and 100 deployments
	for i := 0; i < 200; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{
			Id:          id,
			WorkspaceId: "ws1",
		}
	}

	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("d%d", i)
		deployments[id] = &oapi.Deployment{
			Id:       id,
			SystemId: "ws1",
		}
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		builder := NewBuilder(
			resources,
			deployments,
			map[string]*oapi.Environment{},
			rules,
		)

		_, err := builder.Build(context.Background())
		if err != nil {
			b.Fatalf("Build failed: %v", err)
		}
	}
}

// BenchmarkBuilder_Parallel benchmarks parallel processing
func BenchmarkBuilder_Parallel(b *testing.B) {
	resources := make(map[string]*oapi.Resource)
	deployments := make(map[string]*oapi.Deployment)

	// Create 200 resources and 100 deployments
	for i := 0; i < 200; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{
			Id:          id,
			WorkspaceId: "ws1",
		}
	}

	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("d%d", i)
		deployments[id] = &oapi.Deployment{
			Id:       id,
			SystemId: "ws1",
		}
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		builder := NewBuilder(
			resources,
			deployments,
			map[string]*oapi.Environment{},
			rules,
		).WithParallelProcessing(true).WithChunkSize(50).WithMaxConcurrency(4)

		_, err := builder.Build(context.Background())
		if err != nil {
			b.Fatalf("Build failed: %v", err)
		}
	}
}

// BenchmarkBuilder_LargeDataset_Sequential benchmarks sequential with large dataset
func BenchmarkBuilder_LargeDataset_Sequential(b *testing.B) {
	resources := make(map[string]*oapi.Resource)
	deployments := make(map[string]*oapi.Deployment)

	// Create 500 resources and 200 deployments (100k pairs)
	for i := 0; i < 500; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{
			Id:          id,
			WorkspaceId: "ws1",
		}
	}

	for i := 0; i < 200; i++ {
		id := fmt.Sprintf("d%d", i)
		deployments[id] = &oapi.Deployment{
			Id:       id,
			SystemId: "ws1",
		}
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		builder := NewBuilder(
			resources,
			deployments,
			map[string]*oapi.Environment{},
			rules,
		)

		_, err := builder.Build(context.Background())
		if err != nil {
			b.Fatalf("Build failed: %v", err)
		}
	}
}

// BenchmarkBuilder_LargeDataset_Parallel benchmarks parallel with large dataset
func BenchmarkBuilder_LargeDataset_Parallel(b *testing.B) {
	resources := make(map[string]*oapi.Resource)
	deployments := make(map[string]*oapi.Deployment)

	// Create 500 resources and 200 deployments (100k pairs)
	for i := 0; i < 500; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{
			Id:          id,
			WorkspaceId: "ws1",
		}
	}

	for i := 0; i < 200; i++ {
		id := fmt.Sprintf("d%d", i)
		deployments[id] = &oapi.Deployment{
			Id:       id,
			SystemId: "ws1",
		}
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		builder := NewBuilder(
			resources,
			deployments,
			map[string]*oapi.Environment{},
			rules,
		).WithParallelProcessing(true).WithChunkSize(100).WithMaxConcurrency(8)

		_, err := builder.Build(context.Background())
		if err != nil {
			b.Fatalf("Build failed: %v", err)
		}
	}
}
