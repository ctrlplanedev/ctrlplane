package releasetarget

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
	for i := range count {
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

// Helper function to create test environments
func createTestEnvironments(count int, withSelector bool) []*pb.Environment {
	environments := make([]*pb.Environment, count)
	for i := 0; i < count; i++ {
		env := &pb.Environment{
			Id:       fmt.Sprintf("env-%d", i),
			Name:     fmt.Sprintf("Environment %d", i),
			SystemId: "system-1",
		}
		if withSelector {
			// Selector that matches resources with metadata.env matching the env index
			env.ResourceSelector = pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{
				"type":     "metadata",
				"operator": "equals",
				"value":    fmt.Sprintf("env-%d", i),
				"key":      "env",
			}))
		}
		environments[i] = env
	}
	return environments
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
			dep.ResourceSelector = pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{
				"type":     "metadata",
				"operator": "equals",
				"value":    fmt.Sprintf("dep-%d", i),
				"key":      "deploy",
			}))
		}
		deployments[i] = dep
	}
	return deployments
}

// TestNewComputation tests the NewComputation constructor
func TestNewComputation(t *testing.T) {
	ctx := context.Background()
	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    createTestResources(5, nil),
		Environments: createTestEnvironments(2, false),
		Deployments:  createTestDeployments(2, false),
	}

	c := NewComputation(ctx, req)

	if c == nil {
		t.Fatal("NewComputation returned nil")
	}
	if c.ctx != ctx {
		t.Error("context not set correctly")
	}
	if c.req != req {
		t.Error("request not set correctly")
	}
}

// TestFilterEnvironmentResources_NoSelector tests environment filtering with no selector
func TestFilterEnvironmentResources_NoSelector(t *testing.T) {
	ctx := context.Background()
	resources := createTestResources(10, nil)
	environments := createTestEnvironments(3, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  []*pb.Deployment{},
	}

	c := NewComputation(ctx, req).FilterEnvironmentResources()
	c.envWg.Wait()

	if c.err != nil {
		t.Fatalf("unexpected error: %v", c.err)
	}

	// Environments without selectors should have no resources
	for _, env := range environments {
		resourceSet, ok := c.envResourceSets[env.Id]
		if !ok {
			t.Errorf("environment %s not in resource sets", env.Id)
			continue
		}
		if len(resourceSet) != 0 {
			t.Errorf("environment %s should have 0 resources, got %d", env.Id, len(resourceSet))
		}
	}
}

// TestFilterEnvironmentResources_WithSelector tests environment filtering with selectors
func TestFilterEnvironmentResources_WithSelector(t *testing.T) {
	ctx := context.Background()

	// Create resources with specific metadata for filtering
	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0"},
		"resource-1": {"env": "env-0"},
		"resource-2": {"env": "env-1"},
		"resource-3": {"env": "env-1"},
		"resource-4": {"env": "env-2"},
	}
	resources := createTestResources(5, metadata)
	environments := createTestEnvironments(3, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  []*pb.Deployment{},
	}

	c := NewComputation(ctx, req).FilterEnvironmentResources()
	c.envWg.Wait()

	if c.err != nil {
		t.Fatalf("unexpected error: %v", c.err)
	}

	// Check each environment got the right resources
	expectedCounts := map[string]int{
		"env-0": 2, // resource-0, resource-1
		"env-1": 2, // resource-2, resource-3
		"env-2": 1, // resource-4
	}

	for envID, expectedCount := range expectedCounts {
		resourceSet, ok := c.envResourceSets[envID]
		if !ok {
			t.Errorf("environment %s not in resource sets", envID)
			continue
		}
		if len(resourceSet) != expectedCount {
			t.Errorf("environment %s: expected %d resources, got %d", envID, expectedCount, len(resourceSet))
		}
	}
}

// TestFilterDeploymentResources_NoSelector tests deployment filtering with no selector
func TestFilterDeploymentResources_NoSelector(t *testing.T) {
	ctx := context.Background()
	resources := createTestResources(10, nil)
	deployments := createTestDeployments(3, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: []*pb.Environment{},
		Deployments:  deployments,
	}

	c := NewComputation(ctx, req).FilterDeploymentResources()
	c.depWg.Wait()

	if c.err != nil {
		t.Fatalf("unexpected error: %v", c.err)
	}

	// Deployments without selectors should not be in the map (they match all)
	for _, dep := range deployments {
		_, ok := c.depResourceSets[dep.Id]
		if ok {
			t.Errorf("deployment %s without selector should not be in resource sets", dep.Id)
		}
	}
}

// TestFilterDeploymentResources_WithSelector tests deployment filtering with selectors
func TestFilterDeploymentResources_WithSelector(t *testing.T) {
	ctx := context.Background()

	// Create resources with specific metadata for filtering
	metadata := map[string]map[string]string{
		"resource-0": {"deploy": "dep-0"},
		"resource-1": {"deploy": "dep-0"},
		"resource-2": {"deploy": "dep-1"},
		"resource-3": {"deploy": "dep-1"},
		"resource-4": {"deploy": "dep-2"},
	}
	resources := createTestResources(5, metadata)
	deployments := createTestDeployments(3, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: []*pb.Environment{},
		Deployments:  deployments,
	}

	c := NewComputation(ctx, req).FilterDeploymentResources()
	c.depWg.Wait()

	if c.err != nil {
		t.Fatalf("unexpected error: %v", c.err)
	}

	// Check each deployment got the right resources
	expectedCounts := map[string]int{
		"dep-0": 2, // resource-0, resource-1
		"dep-1": 2, // resource-2, resource-3
		"dep-2": 1, // resource-4
	}

	for depID, expectedCount := range expectedCounts {
		resourceSet, ok := c.depResourceSets[depID]
		if !ok {
			t.Errorf("deployment %s not in resource sets", depID)
			continue
		}
		if len(resourceSet) != expectedCount {
			t.Errorf("deployment %s: expected %d resources, got %d", depID, expectedCount, len(resourceSet))
		}
	}
}

// TestGenerate_EmptyInputs tests generation with empty inputs
func TestGenerate_EmptyInputs(t *testing.T) {
	tests := []struct {
		name         string
		resources    []*pb.Resource
		environments []*pb.Environment
		deployments  []*pb.Deployment
		wantTargets  int
	}{
		{
			name:         "no resources",
			resources:    []*pb.Resource{},
			environments: createTestEnvironments(2, false),
			deployments:  createTestDeployments(2, false),
			wantTargets:  0,
		},
		{
			name:         "no environments",
			resources:    createTestResources(5, nil),
			environments: []*pb.Environment{},
			deployments:  createTestDeployments(2, false),
			wantTargets:  0,
		},
		{
			name:         "no deployments",
			resources:    createTestResources(5, nil),
			environments: createTestEnvironments(2, false),
			deployments:  []*pb.Deployment{},
			wantTargets:  0,
		},
		{
			name:         "all empty",
			resources:    []*pb.Resource{},
			environments: []*pb.Environment{},
			deployments:  []*pb.Deployment{},
			wantTargets:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			req := &pb.ComputeReleaseTargetsRequest{
				Resources:    tt.resources,
				Environments: tt.environments,
				Deployments:  tt.deployments,
			}

			targets, err := NewComputation(ctx, req).
				FilterEnvironmentResources().
				FilterDeploymentResources().
				Generate()

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(targets) != tt.wantTargets {
				t.Errorf("expected %d targets, got %d", tt.wantTargets, len(targets))
			}
		})
	}
}

// TestGenerate_NoSelectors tests generation without any selectors
func TestGenerate_NoSelectors(t *testing.T) {
	ctx := context.Background()
	resources := createTestResources(5, nil)
	environments := createTestEnvironments(2, false)
	deployments := createTestDeployments(3, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	targets, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// With no selectors, environments match no resources, so we expect 0 targets
	expectedTargets := 0
	if len(targets) != expectedTargets {
		t.Errorf("expected %d targets, got %d", expectedTargets, len(targets))
	}
}

// TestGenerate_WithEnvironmentSelectors tests generation with environment selectors only
func TestGenerate_WithEnvironmentSelectors(t *testing.T) {
	ctx := context.Background()

	// Create resources with environment metadata
	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0"},
		"resource-1": {"env": "env-0"},
		"resource-2": {"env": "env-1"},
		"resource-3": {"env": "env-1"},
		"resource-4": {"env": "env-2"},
	}
	resources := createTestResources(5, metadata)
	environments := createTestEnvironments(3, true)
	deployments := createTestDeployments(2, false) // No deployment selectors

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	targets, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// env-0: 2 resources * 2 deployments = 4 targets
	// env-1: 2 resources * 2 deployments = 4 targets
	// env-2: 1 resource * 2 deployments = 2 targets
	// Total: 10 targets
	expectedTargets := 10
	if len(targets) != expectedTargets {
		t.Errorf("expected %d targets, got %d", expectedTargets, len(targets))
	}

	// Verify target structure
	for _, target := range targets {
		if target.Id == "" {
			t.Error("target ID is empty")
		}
		if target.ResourceId == "" {
			t.Error("target ResourceId is empty")
		}
		if target.EnvironmentId == "" {
			t.Error("target EnvironmentId is empty")
		}
		if target.DeploymentId == "" {
			t.Error("target DeploymentId is empty")
		}
	}
}

// TestGenerate_WithDeploymentSelectors tests generation with deployment selectors only
func TestGenerate_WithDeploymentSelectors(t *testing.T) {
	ctx := context.Background()

	// Create resources with deployment metadata
	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0", "deploy": "dep-0"},
		"resource-1": {"env": "env-0", "deploy": "dep-1"},
		"resource-2": {"env": "env-1", "deploy": "dep-0"},
		"resource-3": {"env": "env-1", "deploy": "dep-1"},
	}
	resources := createTestResources(4, metadata)
	environments := createTestEnvironments(2, true)
	deployments := createTestDeployments(2, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	targets, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// env-0 has resource-0 (dep-0) and resource-1 (dep-1)
	// env-1 has resource-2 (dep-0) and resource-3 (dep-1)
	// Each environment x deployment pair matches 1 resource = 4 targets
	expectedTargets := 4
	if len(targets) != expectedTargets {
		t.Errorf("expected %d targets, got %d", expectedTargets, len(targets))
	}

	// Verify each target matches its filters
	targetCount := make(map[string]int)
	for _, target := range targets {
		key := target.EnvironmentId + ":" + target.DeploymentId
		targetCount[key]++
	}

	expectedCombinations := map[string]int{
		"env-0:dep-0": 1,
		"env-0:dep-1": 1,
		"env-1:dep-0": 1,
		"env-1:dep-1": 1,
	}

	for combo, count := range expectedCombinations {
		if targetCount[combo] != count {
			t.Errorf("combination %s: expected %d targets, got %d", combo, count, targetCount[combo])
		}
	}
}

// TestGenerate_MixedSelectors tests generation with both environment and deployment selectors
func TestGenerate_MixedSelectors(t *testing.T) {
	ctx := context.Background()

	// Create resources with both environment and deployment metadata
	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0", "deploy": "dep-0"},
		"resource-1": {"env": "env-0"},
		"resource-2": {"env": "env-1", "deploy": "dep-1"},
		"resource-3": {"env": "env-1"},
	}
	resources := createTestResources(4, metadata)
	environments := createTestEnvironments(2, true)

	// Create mixed deployments: one with selector, one without
	deployments := []*pb.Deployment{
		{
			Id:       "dep-0",
			Name:     "Deployment 0",
			SystemId: "system-1",
			ResourceSelector: pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{
				"type":     "metadata",
				"operator": "equals",
				"value":    "dep-0",
				"key":      "deploy",
			})),
		},
		{
			Id:       "dep-1",
			Name:     "Deployment 1",
			SystemId: "system-1",
			// No selector - matches all env resources
		},
	}

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	targets, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// env-0 has resource-0, resource-1
	//   dep-0 (with selector): matches resource-0 = 1 target
	//   dep-1 (no selector): matches resource-0, resource-1 = 2 targets
	// env-1 has resource-2, resource-3
	//   dep-0 (with selector): matches none = 0 targets
	//   dep-1 (no selector): matches resource-2, resource-3 = 2 targets
	// Total: 5 targets
	expectedTargets := 5
	if len(targets) != expectedTargets {
		t.Errorf("expected %d targets, got %d", expectedTargets, len(targets))
	}
}

// TestGenerate_TargetIDFormat tests that target IDs have the correct format
func TestGenerate_TargetIDFormat(t *testing.T) {
	ctx := context.Background()

	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0"},
	}
	resources := createTestResources(1, metadata)
	environments := createTestEnvironments(1, true)
	deployments := createTestDeployments(1, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	targets, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(targets))
	}

	expectedID := "resource-0:env-0:dep-0"
	if targets[0].Id != expectedID {
		t.Errorf("expected target ID %q, got %q", expectedID, targets[0].Id)
	}
}

// TestNewResourceIDSet tests the NewResourceIDSet helper function
func TestNewResourceIDSet(t *testing.T) {
	resources := createTestResources(5, nil)
	resourceSet := NewResourceIDSet(resources)

	if len(resourceSet) != 5 {
		t.Errorf("expected 5 resources in set, got %d", len(resourceSet))
	}

	for _, res := range resources {
		if !resourceSet[res.Id] {
			t.Errorf("resource %s not in set", res.Id)
		}
	}
}

// Benchmark for environment filtering without selectors
func BenchmarkFilterEnvironmentResources_NoSelector(b *testing.B) {
	ctx := context.Background()
	resources := createTestResources(1000, nil)
	environments := createTestEnvironments(10, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  []*pb.Deployment{},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := NewComputation(ctx, req).FilterEnvironmentResources()
		c.envWg.Wait()
		if c.err != nil {
			b.Fatal(c.err)
		}
	}
}

// Benchmark for environment filtering with selectors
func BenchmarkFilterEnvironmentResources_WithSelector(b *testing.B) {
	ctx := context.Background()

	// Create resources with metadata
	metadata := make(map[string]map[string]string)
	for i := 0; i < 1000; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{"env": fmt.Sprintf("env-%d", i%10)}
	}
	resources := createTestResources(1000, metadata)
	environments := createTestEnvironments(10, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  []*pb.Deployment{},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := NewComputation(ctx, req).FilterEnvironmentResources()
		c.envWg.Wait()
		if c.err != nil {
			b.Fatal(c.err)
		}
	}
}

// Benchmark for deployment filtering without selectors
func BenchmarkFilterDeploymentResources_NoSelector(b *testing.B) {
	ctx := context.Background()
	resources := createTestResources(1000, nil)
	deployments := createTestDeployments(10, false)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: []*pb.Environment{},
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := NewComputation(ctx, req).FilterDeploymentResources()
		c.depWg.Wait()
		if c.err != nil {
			b.Fatal(c.err)
		}
	}
}

// Benchmark for deployment filtering with selectors
func BenchmarkFilterDeploymentResources_WithSelector(b *testing.B) {
	ctx := context.Background()

	// Create resources with metadata
	metadata := make(map[string]map[string]string)
	for i := 0; i < 1000; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{"deploy": fmt.Sprintf("dep-%d", i%10)}
	}
	resources := createTestResources(1000, metadata)
	deployments := createTestDeployments(10, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: []*pb.Environment{},
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := NewComputation(ctx, req).FilterDeploymentResources()
		c.depWg.Wait()
		if c.err != nil {
			b.Fatal(c.err)
		}
	}
}

// Benchmark for full computation with small dataset
func BenchmarkFullComputation_Small(b *testing.B) {
	ctx := context.Background()

	metadata := map[string]map[string]string{
		"resource-0": {"env": "env-0", "deploy": "dep-0"},
		"resource-1": {"env": "env-0", "deploy": "dep-1"},
		"resource-2": {"env": "env-1", "deploy": "dep-0"},
		"resource-3": {"env": "env-1", "deploy": "dep-1"},
	}
	resources := createTestResources(4, metadata)
	environments := createTestEnvironments(2, true)
	deployments := createTestDeployments(2, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewComputation(ctx, req).
			FilterEnvironmentResources().
			FilterDeploymentResources().
			Generate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Benchmark for full computation with medium dataset
func BenchmarkFullComputation_Medium(b *testing.B) {
	ctx := context.Background()

	// Create 100 resources with metadata
	metadata := make(map[string]map[string]string)
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{
			"env":    fmt.Sprintf("env-%d", i%5),
			"deploy": fmt.Sprintf("dep-%d", i%5),
		}
	}
	resources := createTestResources(100, metadata)
	environments := createTestEnvironments(5, true)
	deployments := createTestDeployments(5, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewComputation(ctx, req).
			FilterEnvironmentResources().
			FilterDeploymentResources().
			Generate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Benchmark for full computation with large dataset
func BenchmarkFullComputation_Large(b *testing.B) {
	ctx := context.Background()

	// Create 1000 resources with metadata
	metadata := make(map[string]map[string]string)
	for i := 0; i < 10000; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{
			"env":    fmt.Sprintf("env-%d", i%10),
			"deploy": fmt.Sprintf("dep-%d", i%10),
		}
	}
	resources := createTestResources(10000, metadata)
	environments := createTestEnvironments(10, true)
	deployments := createTestDeployments(10, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewComputation(ctx, req).
			FilterEnvironmentResources().
			FilterDeploymentResources().
			Generate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Benchmark for full computation with mixed selectors
func BenchmarkFullComputation_MixedSelectors(b *testing.B) {
	ctx := context.Background()

	// Create 500 resources with metadata
	metadata := make(map[string]map[string]string)
	for i := 0; i < 500; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{
			"env":    fmt.Sprintf("env-%d", i%5),
			"deploy": fmt.Sprintf("dep-%d", i%5),
		}
	}
	resources := createTestResources(500, metadata)
	environments := createTestEnvironments(5, true)

	// Mix of deployments with and without selectors
	deployments := []*pb.Deployment{
		{Id: "dep-0", Name: "Deployment 0", SystemId: "system-1", ResourceSelector: pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{"type": "metadata", "operator": "equals", "value": "dep-0", "key": "deploy"}))},
		{Id: "dep-1", Name: "Deployment 1", SystemId: "system-1", ResourceSelector: pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{"type": "metadata", "operator": "equals", "value": "dep-1", "key": "deploy"}))},
		{Id: "dep-2", Name: "Deployment 2", SystemId: "system-1"}, // No selector
		{Id: "dep-3", Name: "Deployment 3", SystemId: "system-1", ResourceSelector: pb.NewJsonSelector(mustNewStructFromMap(map[string]interface{}{"type": "metadata", "operator": "equals", "value": "dep-3", "key": "deploy"}))},
		{Id: "dep-4", Name: "Deployment 4", SystemId: "system-1"}, // No selector
	}

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewComputation(ctx, req).
			FilterEnvironmentResources().
			FilterDeploymentResources().
			Generate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Benchmark for concurrent environment and deployment filtering
func BenchmarkConcurrentFiltering(b *testing.B) {
	ctx := context.Background()

	metadata := make(map[string]map[string]string)
	for i := 0; i < 1000; i++ {
		id := fmt.Sprintf("resource-%d", i)
		metadata[id] = map[string]string{
			"env":    fmt.Sprintf("env-%d", i%10),
			"deploy": fmt.Sprintf("dep-%d", i%10),
		}
	}
	resources := createTestResources(1000, metadata)
	environments := createTestEnvironments(10, true)
	deployments := createTestDeployments(10, true)

	req := &pb.ComputeReleaseTargetsRequest{
		Resources:    resources,
		Environments: environments,
		Deployments:  deployments,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := NewComputation(ctx, req).
			FilterEnvironmentResources().
			FilterDeploymentResources()
		c.envWg.Wait()
		c.depWg.Wait()
		if c.err != nil {
			b.Fatal(c.err)
		}
	}
}
