package workspace

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/pb"

	"google.golang.org/protobuf/types/known/structpb"
)

// Helper function to create a selector from a map
func mustNewStructFromMap(m map[string]any) *structpb.Struct {
	s, err := structpb.NewStruct(m)
	if err != nil {
		panic(fmt.Sprintf("failed to create struct: %v", err))
	}
	return s
}

// Helper function to create test resources
func createTestResources(count int, metadata map[string]map[string]string) []*pb.Resource {
	resources := make([]*pb.Resource, count)
	for i := 0; i < count; i++ {
		id := fmt.Sprintf("resource-%d", i)
		meta := map[string]string{}
		if metadata != nil && metadata[id] != nil {
			meta = metadata[id]
		}
		resources[i] = &pb.Resource{
			Id:          id,
			Name:        fmt.Sprintf("Resource %d", i),
			Kind:        "test-resource",
			Identifier:  fmt.Sprintf("identifier-%d", i),
			WorkspaceId: "workspace-1",
			Metadata:    meta,
		}
	}
	return resources
}

// Helper function to create test deployments
func createTestDeployments(count int, withSelector bool) []*pb.Deployment {
	deployments := make([]*pb.Deployment, count)
	for i := 0; i < count; i++ {
		dep := &pb.Deployment{
			Id:       fmt.Sprintf("dep-%d", i),
			Name:     fmt.Sprintf("Deployment %d", i),
			SystemId: "system-1",
		}
		if withSelector {
			// Selector that matches resources with metadata.deploy matching the dep index
			dep.ResourceSelector = mustNewStructFromMap(map[string]interface{}{
				"type":     "metadata",
				"operator": "equals",
				"value":    fmt.Sprintf("dep-%d", i),
				"key":      "deploy",
			})
		}
		deployments[i] = dep
	}
	return deployments
}

// TestHasResources tests the HasResources method
func TestHasResources(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add some resources to the workspace
	resources := createTestResources(3, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
		"resource-2": {"deploy": "dep-1"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployments with selectors
	deployments := createTestDeployments(2, true)
	for _, d := range deployments {
		err := ws.Deployments.Upsert(ctx, d)
		if err != nil {
			t.Fatalf("failed to upsert deployment: %v", err)
		}
	}

	tests := []struct {
		name         string
		deploymentId string
		resourceId   string
		want         bool
	}{
		{
			name:         "resource exists in deployment",
			deploymentId: "dep-0",
			resourceId:   "resource-0",
			want:         true,
		},
		{
			name:         "resource does not exist in deployment",
			deploymentId: "dep-0",
			resourceId:   "resource-2",
			want:         false,
		},
		{
			name:         "deployment does not exist",
			deploymentId: "dep-999",
			resourceId:   "resource-0",
			want:         false,
		},
		{
			name:         "resource does not exist",
			deploymentId: "dep-0",
			resourceId:   "resource-999",
			want:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ws.Deployments.HasResources(tt.deploymentId, tt.resourceId)
			if got != tt.want {
				t.Errorf("HasResources() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestResources tests the Resources method
func TestResources(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add some resources to the workspace
	resources := createTestResources(3, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
		"resource-2": {"deploy": "dep-1"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployments with selectors
	deployments := createTestDeployments(2, true)
	for _, d := range deployments {
		err := ws.Deployments.Upsert(ctx, d)
		if err != nil {
			t.Fatalf("failed to upsert deployment: %v", err)
		}
	}

	tests := []struct {
		name         string
		deploymentId string
		wantCount    int
	}{
		{
			name:         "deployment with resources",
			deploymentId: "dep-0",
			wantCount:    2, // resource-0, resource-1
		},
		{
			name:         "deployment with one resource",
			deploymentId: "dep-1",
			wantCount:    1, // resource-2
		},
		{
			name:         "non-existent deployment",
			deploymentId: "dep-999",
			wantCount:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ws.Deployments.Resources(tt.deploymentId)
			if len(got) != tt.wantCount {
				t.Errorf("Resources() returned %d resources, want %d", len(got), tt.wantCount)
			}
		})
	}
}

// TestRecomputeResources tests the RecomputeResources method
func TestRecomputeResources(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add initial resources
	resources := createTestResources(2, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployment
	deployment := createTestDeployments(1, true)[0]
	err := ws.Deployments.Upsert(ctx, deployment)
	if err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Verify initial state
	depResources := ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 2 {
		t.Fatalf("expected 2 resources initially, got %d", len(depResources))
	}

	// Add a new matching resource
	newResource := &pb.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		Kind:        "test-resource",
		Identifier:  "identifier-2",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"deploy": "dep-0"},
	}
	_, err = ws.Resources.Upsert(ctx, newResource)
	if err != nil {
		t.Fatalf("failed to upsert new resource: %v", err)
	}

	// Recompute
	err = ws.Deployments.RecomputeResources(ctx, deployment.Id)
	if err != nil {
		t.Fatalf("RecomputeResources() error = %v", err)
	}

	// Verify recomputed state
	depResources = ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 3 {
		t.Errorf("expected 3 resources after recompute, got %d", len(depResources))
	}

	// Test recomputing non-existent deployment
	err = ws.Deployments.RecomputeResources(ctx, "non-existent")
	if err == nil {
		t.Error("expected error for non-existent deployment, got nil")
	}
}

// TestUpsert_NoSelector tests upserting a deployment without a selector
func TestUpsert_NoSelector(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add some resources
	resources := createTestResources(5, nil)
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployment without selector
	deployment := &pb.Deployment{
		Id:       "dep-0",
		Name:     "Deployment 0",
		SystemId: "system-1",
		// No ResourceSelector
	}

	err := ws.Deployments.Upsert(ctx, deployment)
	if err != nil {
		t.Fatalf("Upsert() error = %v", err)
	}

	// Deployment with no selector should match all resources
	depResources := ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 5 {
		t.Errorf("expected 5 resources (all resources), got %d", len(depResources))
	}
}

// TestUpsert_WithSelector tests upserting a deployment with a selector
func TestUpsert_WithSelector(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add resources with metadata
	resources := createTestResources(5, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0", "env": "prod"},
		"resource-1": {"deploy": "dep-0", "env": "dev"},
		"resource-2": {"deploy": "dep-1", "env": "prod"},
		"resource-3": {"deploy": "dep-1", "env": "dev"},
		"resource-4": {"env": "staging"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	tests := []struct {
		name          string
		deployment    *pb.Deployment
		expectedCount int
	}{
		{
			name: "selector matching two resources",
			deployment: &pb.Deployment{
				Id:       "dep-0",
				Name:     "Deployment 0",
				SystemId: "system-1",
				ResourceSelector: mustNewStructFromMap(map[string]interface{}{
					"type":     "metadata",
					"operator": "equals",
					"value":    "dep-0",
					"key":      "deploy",
				}),
			},
			expectedCount: 2,
		},
		{
			name: "selector matching env prod",
			deployment: &pb.Deployment{
				Id:       "dep-prod",
				Name:     "Production Deployment",
				SystemId: "system-1",
				ResourceSelector: mustNewStructFromMap(map[string]interface{}{
					"type":     "metadata",
					"operator": "equals",
					"value":    "prod",
					"key":      "env",
				}),
			},
			expectedCount: 2, // resource-0, resource-2
		},
		{
			name: "selector matching no resources",
			deployment: &pb.Deployment{
				Id:       "dep-none",
				Name:     "No Match Deployment",
				SystemId: "system-1",
				ResourceSelector: mustNewStructFromMap(map[string]interface{}{
					"type":     "metadata",
					"operator": "equals",
					"value":    "nonexistent",
					"key":      "deploy",
				}),
			},
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ws.Deployments.Upsert(ctx, tt.deployment)
			if err != nil {
				t.Fatalf("Upsert() error = %v", err)
			}

			depResources := ws.Deployments.Resources(tt.deployment.Id)
			if len(depResources) != tt.expectedCount {
				t.Errorf("expected %d resources, got %d", tt.expectedCount, len(depResources))
			}
		})
	}
}

// TestUpsert_UpdateExisting tests updating an existing deployment
func TestUpsert_UpdateExisting(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add resources
	resources := createTestResources(3, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-1"},
		"resource-2": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create initial deployment
	deployment := &pb.Deployment{
		Id:       "dep-0",
		Name:     "Deployment 0",
		SystemId: "system-1",
		ResourceSelector: mustNewStructFromMap(map[string]interface{}{
			"type":     "metadata",
			"operator": "equals",
			"value":    "dep-0",
			"key":      "deploy",
		}),
	}

	err := ws.Deployments.Upsert(ctx, deployment)
	if err != nil {
		t.Fatalf("initial Upsert() error = %v", err)
	}

	// Verify initial state
	depResources := ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 2 {
		t.Fatalf("expected 2 resources initially, got %d", len(depResources))
	}

	// Update deployment with different selector
	updatedDeployment := &pb.Deployment{
		Id:       "dep-0",
		Name:     "Deployment 0 Updated",
		SystemId: "system-1",
		ResourceSelector: mustNewStructFromMap(map[string]interface{}{
			"type":     "metadata",
			"operator": "equals",
			"value":    "dep-1",
			"key":      "deploy",
		}),
	}

	err = ws.Deployments.Upsert(ctx, updatedDeployment)
	if err != nil {
		t.Fatalf("update Upsert() error = %v", err)
	}

	// Verify updated state
	depResources = ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 1 {
		t.Errorf("expected 1 resource after update, got %d", len(depResources))
	}

	// Verify the deployment was updated in the workspace
	storedDeployment, exists := ws.deployments.Get(deployment.Id)
	if !exists {
		t.Fatal("deployment not found after update")
	}
	if storedDeployment.Name != "Deployment 0 Updated" {
		t.Errorf("deployment name not updated, got %s", storedDeployment.Name)
	}
}

// TestUpsert_InvalidSelector tests upserting a deployment with an invalid selector
func TestUpsert_InvalidSelector(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Create deployment with invalid selector
	deployment := &pb.Deployment{
		Id:       "dep-0",
		Name:     "Deployment 0",
		SystemId: "system-1",
		ResourceSelector: mustNewStructFromMap(map[string]interface{}{
			"type": "invalid-type",
		}),
	}

	err := ws.Deployments.Upsert(ctx, deployment)
	if err == nil {
		t.Error("expected error for invalid selector, got nil")
	}
}

// TestRemove tests the Remove method
func TestRemove(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add resources
	resources := createTestResources(2, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployment
	deployment := createTestDeployments(1, true)[0]
	err := ws.Deployments.Upsert(ctx, deployment)
	if err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Verify deployment exists
	_, exists := ws.deployments.Get(deployment.Id)
	if !exists {
		t.Fatal("deployment should exist before removal")
	}

	depResources := ws.Deployments.Resources(deployment.Id)
	if len(depResources) == 0 {
		t.Fatal("deployment should have resources before removal")
	}

	// Remove deployment
	ws.Deployments.Remove(deployment.Id)

	// Verify deployment is removed
	_, exists = ws.deployments.Get(deployment.Id)
	if exists {
		t.Error("deployment should not exist after removal")
	}

	// Verify deployment resources are removed
	depResources = ws.Deployments.Resources(deployment.Id)
	if len(depResources) != 0 {
		t.Error("deployment resources should be empty after removal")
	}

	// Verify workspace resources still exist
	if ws.resources.Count() != 2 {
		t.Errorf("workspace resources should still exist, got %d resources", ws.resources.Count())
	}
}

// TestRemove_NonExistent tests removing a non-existent deployment
func TestRemove_NonExistent(t *testing.T) {
	ws := New()

	// This should not panic or error
	ws.Deployments.Remove("non-existent")

	// Verify count is still 0
	if ws.deployments.Count() != 0 {
		t.Errorf("expected 0 deployments, got %d", ws.deployments.Count())
	}
}

// TestConcurrentUpsert tests concurrent upserts to ensure thread safety
func TestConcurrentUpsert(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add resources
	resources := createTestResources(10, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-1"},
		"resource-2": {"deploy": "dep-2"},
		"resource-3": {"deploy": "dep-3"},
		"resource-4": {"deploy": "dep-4"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Concurrently upsert deployments
	deployments := createTestDeployments(5, true)
	errChan := make(chan error, len(deployments))

	for _, dep := range deployments {
		go func(d *pb.Deployment) {
			errChan <- ws.Deployments.Upsert(ctx, d)
		}(dep)
	}

	// Wait for all to complete
	for i := 0; i < len(deployments); i++ {
		if err := <-errChan; err != nil {
			t.Errorf("concurrent Upsert() error = %v", err)
		}
	}

	// Verify all deployments were created
	if ws.deployments.Count() != 5 {
		t.Errorf("expected 5 deployments, got %d", ws.deployments.Count())
	}
}

// TestConcurrentReadWrite tests concurrent reads and writes
func TestConcurrentReadWrite(t *testing.T) {
	ctx := context.Background()
	ws := New()

	// Add resources
	resources := createTestResources(10, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, err := ws.Resources.Upsert(ctx, r)
		if err != nil {
			t.Fatalf("failed to upsert resource: %v", err)
		}
	}

	// Create deployment
	deployment := createTestDeployments(1, true)[0]
	err := ws.Deployments.Upsert(ctx, deployment)
	if err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	done := make(chan bool)

	// Concurrent readers
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = ws.Deployments.Resources(deployment.Id)
				_ = ws.Deployments.HasResources(deployment.Id, "resource-0")
			}
			done <- true
		}()
	}

	// Concurrent writers
	for i := 0; i < 5; i++ {
		go func() {
			for j := 0; j < 20; j++ {
				_ = ws.Deployments.Upsert(ctx, deployment)
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 15; i++ {
		<-done
	}

	// Verify deployment still exists and has resources
	depResources := ws.Deployments.Resources(deployment.Id)
	if len(depResources) == 0 {
		t.Error("deployment should have resources after concurrent operations")
	}
}

// BenchmarkHasResources benchmarks the HasResources method
func BenchmarkHasResources(b *testing.B) {
	ctx := context.Background()
	ws := New()

	resources := createTestResources(100, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, _ = ws.Resources.Upsert(ctx, r)
	}

	deployment := createTestDeployments(1, true)[0]
	_ = ws.Deployments.Upsert(ctx, deployment)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ws.Deployments.HasResources(deployment.Id, "resource-0")
	}
}

// BenchmarkResources benchmarks the Resources method
func BenchmarkResources(b *testing.B) {
	ctx := context.Background()
	ws := New()

	resources := createTestResources(100, map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
	})
	for _, r := range resources {
		_, _ = ws.Resources.Upsert(ctx, r)
	}

	deployment := createTestDeployments(1, true)[0]
	_ = ws.Deployments.Upsert(ctx, deployment)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ws.Deployments.Resources(deployment.Id)
	}
}

// BenchmarkUpsert_NoSelector benchmarks upserting without a selector
func BenchmarkUpsert_NoSelector(b *testing.B) {
	ctx := context.Background()
	ws := New()

	resources := createTestResources(100, nil)
	for _, r := range resources {
		_, _ = ws.Resources.Upsert(ctx, r)
	}

	deployment := &pb.Deployment{
		Id:       "dep-0",
		Name:     "Deployment 0",
		SystemId: "system-1",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ws.Deployments.Upsert(ctx, deployment)
	}
}

// BenchmarkUpsert_WithSelector benchmarks upserting with a selector
func BenchmarkUpsert_WithSelector(b *testing.B) {
	ctx := context.Background()
	ws := New()

	metadata := make(map[string]map[string]string)
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{"deploy": fmt.Sprintf("dep-%d", i%10)}
	}
	resources := createTestResources(100, metadata)
	for _, r := range resources {
		_, _ = ws.Resources.Upsert(ctx, r)
	}

	deployment := createTestDeployments(1, true)[0]

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ws.Deployments.Upsert(ctx, deployment)
	}
}

// BenchmarkRecomputeResources benchmarks the RecomputeResources method
func BenchmarkRecomputeResources(b *testing.B) {
	ctx := context.Background()
	ws := New()

	metadata := make(map[string]map[string]string)
	for i := 0; i < 1000; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{"deploy": "dep-0"}
	}
	resources := createTestResources(1000, metadata)
	for _, r := range resources {
		_, _ = ws.Resources.Upsert(ctx, r)
	}

	deployment := createTestDeployments(1, true)[0]
	_ = ws.Deployments.Upsert(ctx, deployment)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ws.Deployments.RecomputeResources(ctx, deployment.Id)
	}
}
