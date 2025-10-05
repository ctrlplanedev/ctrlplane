package e2e

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_ReleaseTargetCreationAndRemoval(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment()
	d1.Name = "deployment-1"
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment with a selector to match all resources
	e1 := c.NewEnvironment()
	e1.Name = "env-prod"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	fmt.Println(len(engine.Workspace().Environments().Resources(e1.Id)))

	// Verify no release targets exist yet (no resources)
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets before resources, got %d", len(releaseTargets))
	}

	// Create a resource - this should trigger release target creation
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	fmt.Println(len(engine.Workspace().Environments().Resources(e1.Id)))

	// Verify release target was created
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Get the single release target from the map
	var rt *pb.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}
	if rt.DeploymentId != d1.Id {
		t.Fatalf("release target deployment mismatch: got %s, want %s", rt.DeploymentId, d1.Id)
	}
	if rt.EnvironmentId != e1.Id {
		t.Fatalf("release target environment mismatch: got %s, want %s", rt.EnvironmentId, e1.Id)
	}
	if rt.ResourceId != r1.Id {
		t.Fatalf("release target resource mismatch: got %s, want %s", rt.ResourceId, r1.Id)
	}

	// Delete the deployment - release target should be removed
	engine.PushEvent(ctx, handler.DeploymentDelete, d1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deployment deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetEnvironmentRemoval(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create system, deployment, environment, and resource
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	d1 := c.NewDeployment()
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	e1 := c.NewEnvironment()
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify release target was created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Delete the environment - release target should be removed
	engine.PushEvent(ctx, handler.EnvironmentDelete, e1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after environment deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetResourceRemoval(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create system, deployment, environment, and resource
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	d1 := c.NewDeployment()
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	e1 := c.NewEnvironment()
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify release target was created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Delete the resource - release target should be removed
	engine.PushEvent(ctx, handler.ResourceDelete, r1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after resource deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetWithSelectors(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment with a selector
	d1 := c.NewDeployment()
	d1.Name = "deployment-prod-only"
	d1.SystemId = sys.Id
	d1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment with a selector
	e1 := c.NewEnvironment()
	e1.Name = "env-prod"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a prod resource - should match and create release target
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-prod"
	r1.Metadata = map[string]string{
		"env": "prod",
	}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify release target was created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target for prod resource, got %d", len(releaseTargets))
	}

	// Create a dev resource - should NOT match and NOT create release target
	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-dev"
	r2.Metadata = map[string]string{
		"env": "dev",
	}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Verify still only 1 release target
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target (dev resource should not match), got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSelectorUpdate(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment without a selector
	d1 := c.NewDeployment()
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment with selector to match all resources
	e1 := c.NewEnvironment()
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create two resources with different metadata
	r1 := c.NewResource(workspaceID)
	r1.Metadata = map[string]string{"env": "prod"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Both resources should match - 2 release targets
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets without selectors, got %d", len(releaseTargets))
	}

	// Update deployment to add a selector for prod only
	d1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// Now only prod resource should match - 1 release target
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after adding deployment selector, got %d", len(releaseTargets))
	}

	// Verify it's the prod resource
	var rt *pb.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}
	if rt.ResourceId != r1.Id {
		t.Fatalf("expected release target for prod resource, got resource %s", rt.ResourceId)
	}

	// Remove the deployment selector
	d1.ResourceSelector = nil
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// Both resources should match again - 2 release targets
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after removing deployment selector, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSystemChange(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create two systems
	sys1 := c.NewSystem()
	sys1.Name = "system-1"
	sys2 := c.NewSystem()
	sys2.Name = "system-2"

	engine.PushEvent(ctx, handler.SystemCreate, sys1)
	engine.PushEvent(ctx, handler.SystemCreate, sys2)

	// Create deployment and environment for system 1
	d1 := c.NewDeployment()
	d1.Name = "deployment-sys1"
	d1.SystemId = sys1.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	e1 := c.NewEnvironment()
	e1.Name = "env-sys1"
	e1.SystemId = sys1.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify release target was created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Move deployment to system 2 - should remove release target
	// (environment is still in system 1, so no matching deployment+environment pair)
	d1.SystemId = sys2.Id
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after moving deployment to different system, got %d", len(releaseTargets))
	}

	// Move environment to system 2 as well - should recreate release target
	e1.SystemId = sys2.Id
	engine.PushEvent(ctx, handler.EnvironmentUpdate, e1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after moving both to system 2, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetMultipleDeploymentsEnvironments(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create 2 deployments
	d1 := c.NewDeployment()
	d1.Name = "deployment-1"
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	d2 := c.NewDeployment()
	d2.Name = "deployment-2"
	d2.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create 2 environments with selectors to match all resources
	e1 := c.NewEnvironment()
	e1.Name = "env-dev"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	e2 := c.NewEnvironment()
	e2.Name = "env-prod"
	e2.SystemId = sys.Id
	e2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)

	// Create 2 resources
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Expected: 2 deployments × 2 environments × 2 resources = 8 release targets
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 8 {
		t.Fatalf("expected 8 release targets (2×2×2), got %d", len(releaseTargets))
	}

	// Delete one deployment - should reduce to 4 release targets
	engine.PushEvent(ctx, handler.DeploymentDelete, d2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets after deleting 1 deployment, got %d", len(releaseTargets))
	}

	// Delete one environment - should reduce to 2 release targets
	engine.PushEvent(ctx, handler.EnvironmentDelete, e2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after deleting 1 environment, got %d", len(releaseTargets))
	}

	// Delete one resource - should reduce to 1 release target
	engine.PushEvent(ctx, handler.ResourceDelete, r2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after deleting 1 resource, got %d", len(releaseTargets))
	}

	// Verify the remaining release target is correct
	var rt *pb.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}
	if rt.DeploymentId != d1.Id || rt.EnvironmentId != e1.Id || rt.ResourceId != r1.Id {
		t.Fatalf("unexpected release target combination: deployment=%s, environment=%s, resource=%s",
			rt.DeploymentId, rt.EnvironmentId, rt.ResourceId)
	}
}

func TestEngine_ReleaseTargetComplexSelectors(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create deployment with selector for prod resources
	d1 := c.NewDeployment()
	d1.Name = "deployment-prod"
	d1.SystemId = sys.Id
	d1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create deployment with selector for critical priority
	d2 := c.NewDeployment()
	d2.Name = "deployment-critical"
	d2.SystemId = sys.Id
	d2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "critical",
		"key":      "priority",
	})
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create environment with selector for us-east region
	e1 := c.NewEnvironment()
	e1.Name = "env-us-east"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "us-east-1",
		"key":      "region",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create resources with different metadata combinations
	// Resource 1: prod + us-east-1 + critical (matches both deployments and environment)
	r1 := c.NewResource(workspaceID)
	r1.Metadata = map[string]string{
		"env":      "prod",
		"region":   "us-east-1",
		"priority": "critical",
	}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Resource 2: prod + us-east-1 (matches d1 and environment)
	r2 := c.NewResource(workspaceID)
	r2.Metadata = map[string]string{
		"env":    "prod",
		"region": "us-east-1",
	}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Resource 3: critical + us-west (matches d2 but not environment)
	r3 := c.NewResource(workspaceID)
	r3.Metadata = map[string]string{
		"priority": "critical",
		"region":   "us-west-1",
	}
	engine.PushEvent(ctx, handler.ResourceCreate, r3)

	// Expected release targets:
	// - r1 matches d1 + e1 = 1 release target
	// - r1 matches d2 + e1 = 1 release target
	// - r2 matches d1 + e1 = 1 release target
	// - r3 matches d2 but not e1 (region mismatch) = 0 release targets
	// Total = 3 release targets
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets with complex selectors, got %d", len(releaseTargets))
	}

	// Update resource 3 to match the environment selector
	r3.Metadata["region"] = "us-east-1"
	engine.PushEvent(ctx, handler.ResourceUpdate, r3)

	// Now r3 should create 1 more release target
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets after updating r3, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetEnvironmentWithoutSelector(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create deployment without selector (matches all resources)
	d1 := c.NewDeployment()
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create environment WITHOUT a resource selector
	// This should match NO resources
	e1 := c.NewEnvironment()
	e1.SystemId = sys.Id
	// Explicitly NOT setting ResourceSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create resources
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Metadata = map[string]string{"env": "prod"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Verify NO release targets are created because environment has no selector
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets (environment without selector should match no resources), got %d", len(releaseTargets))
	}

	// Now add a selector to the environment to match all resources
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentUpdate, e1)

	// Now release targets should be created
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after adding environment selector, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSystemDeletion(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create deployment and environment
	d1 := c.NewDeployment()
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	e1 := c.NewEnvironment()
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create resources
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Verify release targets were created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Delete the system - should remove all associated deployments, environments, and release targets
	engine.PushEvent(ctx, handler.SystemDelete, sys)

	// Verify all release targets are removed
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after system deletion, got %d", len(releaseTargets))
	}

	// Verify deployment and environment are also removed
	if _, ok := engine.Workspace().Deployments().Get(d1.Id); ok {
		t.Fatalf("deployment should be removed when system is deleted")
	}

	if _, ok := engine.Workspace().Environments().Get(e1.Id); ok {
		t.Fatalf("environment should be removed when system is deleted")
	}
}

func TestEngine_ReleaseTargetEnvironmentAndDeploymentDelete(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create 2 deployments
	d1 := c.NewDeployment()
	d1.Name = "deployment-1"
	d1.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	d2 := c.NewDeployment()
	d2.Name = "deployment-2"
	d2.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create 2 environments with selectors to match all resources
	e1 := c.NewEnvironment()
	e1.Name = "env-1"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	e2 := c.NewEnvironment()
	e2.Name = "env-2"
	e2.SystemId = sys.Id
	e2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Expected: 2 deployments × 2 environments × 1 resource = 4 release targets
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets (2×2×1), got %d", len(releaseTargets))
	}

	// Delete one deployment - should remove 2 release targets (d2 × 2 environments)
	engine.PushEvent(ctx, handler.DeploymentDelete, d2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after deleting deployment, got %d", len(releaseTargets))
	}

	// Verify remaining release targets are for d1
	for _, rt := range releaseTargets {
		if rt.DeploymentId != d1.Id {
			t.Fatalf("expected all release targets to be for deployment %s, got %s", d1.Id, rt.DeploymentId)
		}
		if rt.ResourceId != r1.Id {
			t.Fatalf("expected all release targets to be for resource %s, got %s", r1.Id, rt.ResourceId)
		}
	}

	// Delete one environment - should remove 1 release target (d1 × e2)
	engine.PushEvent(ctx, handler.EnvironmentDelete, e2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after deleting environment, got %d", len(releaseTargets))
	}

	// Verify the remaining release target is for d1 + e1 + r1
	var rt *pb.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}
	if rt.DeploymentId != d1.Id {
		t.Fatalf("expected release target deployment %s, got %s", d1.Id, rt.DeploymentId)
	}
	if rt.EnvironmentId != e1.Id {
		t.Fatalf("expected release target environment %s, got %s", e1.Id, rt.EnvironmentId)
	}
	if rt.ResourceId != r1.Id {
		t.Fatalf("expected release target resource %s, got %s", r1.Id, rt.ResourceId)
	}

	// Delete the remaining deployment - should remove all release targets
	engine.PushEvent(ctx, handler.DeploymentDelete, d1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deleting all deployments, got %d", len(releaseTargets))
	}

	// Recreate deployment
	d3 := c.NewDeployment()
	d3.Name = "deployment-3"
	d3.SystemId = sys.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d3)

	// Should have 1 release target now (d3 × e1 × r1)
	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after recreating deployment, got %d", len(releaseTargets))
	}

	// Delete the remaining environment - should remove all release targets
	engine.PushEvent(ctx, handler.EnvironmentDelete, e1)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deleting all environments, got %d", len(releaseTargets))
	}
}
