package compute

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

// BenchmarkFilterEntities_WithCEL benchmarks filtering entities with CEL selectors
func BenchmarkFilterEntities_WithCEL(b *testing.B) {
	ctx := context.Background()

	numEntities := 10_000

	// Create mixed entities
	allEntities := make([]*oapi.RelatableEntity, 0, numEntities*2)

	// Create resources with various metadata
	for i := range numEntities {
		resource := &oapi.Resource{
			Id:          fmt.Sprintf("resource-%d", i),
			Name:        fmt.Sprintf("Resource %d", i),
			WorkspaceId: "workspace-1",
			Kind:        "pod",
			Version:     "v1",
			Config:      map[string]any{"region": "us-east-1"},
			Metadata: map[string]string{
				"env":    strconv.Itoa(i % 3), // 0=prod, 1=staging, 2=dev
				"region": strconv.Itoa(i % 10),
			},
		}
		allEntities = append(allEntities, relationships.NewResourceEntity(resource))
	}

	// Create deployments
	for i := range numEntities {
		deployment := &oapi.Deployment{
			Id:             fmt.Sprintf("deployment-%d", i),
			Name:           fmt.Sprintf("Deployment %d", i),
			Slug:           fmt.Sprintf("deployment-%d", i),
			SystemId:       strconv.Itoa(i % 10),
			JobAgentConfig: customJobAgentConfig(nil),
		}
		allEntities = append(allEntities, relationships.NewDeploymentEntity(deployment))
	}

	// Create CEL selector that matches resources with env="0" (prod)
	fromSelector := &oapi.Selector{}
	err := fromSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == '0'",
	})
	if err != nil {
		b.Fatal(err)
	}

	// Create CEL selector that matches deployments with systemId 0-4
	toSelector := &oapi.Selector{}
	err = toSelector.FromCelSelector(oapi.CelSelector{
		Cel: "int(deployment.systemId) < 5",
	})
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		fromEntities, toEntities := filterEntities(
			ctx,
			allEntities,
			oapi.RelatableEntityTypeResource,
			fromSelector,
			oapi.RelatableEntityTypeDeployment,
			toSelector,
		)

		// Prevent compiler optimization
		if len(fromEntities) == 0 && len(toEntities) == 0 {
			b.Fatal("unexpected empty results")
		}
	}
}

// BenchmarkFilterEntities_NoSelector benchmarks filtering without selectors
func BenchmarkFilterEntities_NoSelector(b *testing.B) {
	ctx := context.Background()

	numEntities := 10000

	// Create mixed entities
	allEntities := make([]*oapi.RelatableEntity, 0, numEntities*2)

	// Create resources
	for i := 0; i < numEntities; i++ {
		resource := &oapi.Resource{
			Id:          fmt.Sprintf("resource-%d", i),
			Name:        fmt.Sprintf("Resource %d", i),
			WorkspaceId: "workspace-1",
			Kind:        "pod",
			Version:     "v1",
			Metadata:    map[string]string{"region": strconv.Itoa(i % 10)},
		}
		allEntities = append(allEntities, relationships.NewResourceEntity(resource))
	}

	// Create deployments
	for i := 0; i < numEntities; i++ {
		deployment := &oapi.Deployment{
			Id:             fmt.Sprintf("deployment-%d", i),
			Name:           fmt.Sprintf("Deployment %d", i),
			Slug:           fmt.Sprintf("deployment-%d", i),
			SystemId:       strconv.Itoa(i % 10),
			JobAgentConfig: customJobAgentConfig(nil),
		}
		allEntities = append(allEntities, relationships.NewDeploymentEntity(deployment))
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		fromEntities, toEntities := filterEntities(
			ctx,
			allEntities,
			oapi.RelatableEntityTypeResource,
			nil, // No selector
			oapi.RelatableEntityTypeDeployment,
			nil, // No selector
		)

		// Prevent compiler optimization
		if len(fromEntities) == 0 && len(toEntities) == 0 {
			b.Fatal("unexpected empty results")
		}
	}
}

// BenchmarkFilterEntities_HighSelectivity benchmarks with highly selective CEL
func BenchmarkFilterEntities_HighSelectivity(b *testing.B) {
	ctx := context.Background()

	numEntities := 10000

	// Create mixed entities
	allEntities := make([]*oapi.RelatableEntity, 0, numEntities*2)

	// Create resources with various metadata
	for i := 0; i < numEntities; i++ {
		resource := &oapi.Resource{
			Id:          fmt.Sprintf("resource-%d", i),
			Name:        fmt.Sprintf("Resource %d", i),
			WorkspaceId: "workspace-1",
			Kind:        "pod",
			Version:     "v1",
			Metadata: map[string]string{
				"env":    strconv.Itoa(i % 100), // 100 different values
				"region": strconv.Itoa(i % 10),
			},
		}
		allEntities = append(allEntities, relationships.NewResourceEntity(resource))
	}

	// Create deployments
	for i := 0; i < numEntities; i++ {
		deployment := &oapi.Deployment{
			Id:             fmt.Sprintf("deployment-%d", i),
			Name:           fmt.Sprintf("Deployment %d", i),
			Slug:           fmt.Sprintf("deployment-%d", i),
			SystemId:       strconv.Itoa(i % 100),
			JobAgentConfig: customJobAgentConfig(nil),
		}
		allEntities = append(allEntities, relationships.NewDeploymentEntity(deployment))
	}

	// Very selective - matches only 1% of entities
	fromSelector := &oapi.Selector{}
	err := fromSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == '0'", // Only 1/100 match
	})
	if err != nil {
		b.Fatal(err)
	}

	toSelector := &oapi.Selector{}
	err = toSelector.FromCelSelector(oapi.CelSelector{
		Cel: "deployment.systemId == '0'", // Only 1/100 match
	})
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		fromEntities, toEntities := filterEntities(
			ctx,
			allEntities,
			oapi.RelatableEntityTypeResource,
			fromSelector,
			oapi.RelatableEntityTypeDeployment,
			toSelector,
		)

		// Should have ~100 entities each (1% of 10k)
		_ = fromEntities
		_ = toEntities
	}
}
