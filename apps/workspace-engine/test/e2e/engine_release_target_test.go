package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_ReleaseTargetCreationAndRemoval(t *testing.T) {
	d1Id := "d1-id"
	e1Id := "e1-id"
	r1Id := "r1-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
				integration.DeploymentName("deployment-1"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
				integration.EnvironmentName("env-prod"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
	)
	ctx := context.Background()

	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)

	// Verify no release targets exist yet (no resources)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets before resources, got %d", len(releaseTargets))
	}

	// Create a resource - this should trigger release target creation
	r1 := c.NewResource(engine.Workspace().ID)
	r1.Id = r1Id
	r1.Name = "resource-1"
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify release target was created
	releaseTargets, err = engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Get the single release target from the map
	var rt *oapi.ReleaseTarget
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

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deployment deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetEnvironmentRemoval(t *testing.T) {
	e1Id := "e1-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(),
	)
	ctx := context.Background()

	e1, _ := engine.Workspace().Environments().Get(e1Id)

	// Verify release target was created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Delete the environment - release target should be removed
	engine.PushEvent(ctx, handler.EnvironmentDelete, e1)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after environment deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetResourceRemoval(t *testing.T) {
	r1Id := "r1-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(),
			integration.WithEnvironment(
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1Id),
		),
	)
	ctx := context.Background()

	r1, _ := engine.Workspace().Resources().Get(r1Id)

	// Verify release target was created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Delete the resource - release target should be removed
	engine.PushEvent(ctx, handler.ResourceDelete, r1)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after resource deletion, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetWithSelectors(t *testing.T) {
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentName("deployment-prod-only"),
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "prod",
					"key":      "env",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-prod"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "prod",
					"key":      "env",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-prod"),
			integration.ResourceMetadata(map[string]string{
				"env": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceName("resource-dev"),
			integration.ResourceMetadata(map[string]string{
				"env": "dev",
			}),
		),
	)
	ctx := context.Background()

	// Verify release target was created (only for prod resource)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target for prod resource, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSelectorUpdate(t *testing.T) {
	d1Id := "d1-id"
	r1Id := "r1-id"
	r2Id := "r2-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
			),
			integration.WithEnvironment(
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1Id),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceID(r2Id),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
	)
	ctx := context.Background()

	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	r1, _ := engine.Workspace().Resources().Get(r1Id)

	// Without deployment selector (nil), no resources should match - 0 release targets
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets with nil deployment selector, got %d", len(releaseTargets))
	}

	// Update deployment to add a match-all selector
	d1.ResourceSelector = c.NewJsonSelector(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// Both resources should match - 2 release targets
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets with match-all deployment selector, got %d", len(releaseTargets))
	}

	// Update deployment to add a selector for prod only
	d1.ResourceSelector = c.NewJsonSelector(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// Now only prod resource should match - 1 release target
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after adding deployment selector, got %d", len(releaseTargets))
	}

	// Verify it's the prod resource
	var rt *oapi.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}
	if rt.ResourceId != r1.Id {
		t.Fatalf("expected release target for prod resource, got resource %s", rt.ResourceId)
	}

	// Remove the deployment selector (set to nil)
	d1.ResourceSelector = nil
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// With nil selector, no resources should match - 0 release targets
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after removing deployment selector, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSystemChange(t *testing.T) {
	sys1Id := "sys1-id"
	sys2Id := "sys2-id"
	d1Id := "d1-id"
	e1Id := "e1-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sys1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
				integration.DeploymentName("deployment-sys1"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
				integration.EnvironmentName("env-sys1"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(),
	)
	ctx := context.Background()

	// Create system 2
	sys2 := c.NewSystem(engine.Workspace().ID)
	sys2.Id = sys2Id
	sys2.Name = "system-2"
	engine.PushEvent(ctx, handler.SystemCreate, sys2)

	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)

	// Verify release target was created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Move deployment to system 2 - should remove release target
	// (environment is still in system 1, so no matching deployment+environment pair)
	d1Updated := *d1 // Create a copy of the deployment value
	d1Updated.SystemId = sys2.Id
	engine.PushEvent(ctx, handler.DeploymentUpdate, &d1Updated)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after moving deployment to different system, got %d", len(releaseTargets))
	}

	// Move environment to system 2 as well - should recreate release target
	e1Updated := *e1 // Create a copy of the environment value
	e1Updated.SystemId = sys2.Id
	engine.PushEvent(ctx, handler.EnvironmentUpdate, &e1Updated)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after moving both to system 2, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetMultipleDeploymentsEnvironments(t *testing.T) {
	d1Id := "d1-id"
	d2Id := "d2-id"
	e1Id := "e1-id"
	e2Id := "e2-id"
	r1Id := "r1-id"
	r2Id := "r2-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
				integration.DeploymentName("deployment-1"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2Id),
				integration.DeploymentName("deployment-2"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
				integration.EnvironmentName("env-dev"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2Id),
				integration.EnvironmentName("env-prod"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1Id),
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceID(r2Id),
			integration.ResourceName("resource-2"),
		),
	)
	ctx := context.Background()

	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	d2, _ := engine.Workspace().Deployments().Get(d2Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)
	e2, _ := engine.Workspace().Environments().Get(e2Id)
	r1, _ := engine.Workspace().Resources().Get(r1Id)
	r2, _ := engine.Workspace().Resources().Get(r2Id)

	// Expected: 2 deployments × 2 environments × 2 resources = 8 release targets
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 8 {
		t.Fatalf("expected 8 release targets (2×2×2), got %d", len(releaseTargets))
	}

	// Delete one deployment - should reduce to 4 release targets
	engine.PushEvent(ctx, handler.DeploymentDelete, d2)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets after deleting 1 deployment, got %d", len(releaseTargets))
	}

	// Delete one environment - should reduce to 2 release targets
	engine.PushEvent(ctx, handler.EnvironmentDelete, e2)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after deleting 1 environment, got %d", len(releaseTargets))
	}

	// Delete one resource - should reduce to 1 release target
	engine.PushEvent(ctx, handler.ResourceDelete, r2)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after deleting 1 resource, got %d", len(releaseTargets))
	}

	// Verify the remaining release target is correct
	var rt *oapi.ReleaseTarget
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
	r3Id := "r3-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentName("deployment-prod"),
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "prod",
					"key":      "env",
				}),
			),
			integration.WithDeployment(
				integration.DeploymentName("deployment-critical"),
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "critical",
					"key":      "priority",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-us-east"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "us-east-1",
					"key":      "region",
				}),
			),
		),
		// Resource 1: prod + us-east-1 + critical (matches both deployments and environment)
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{
				"env":      "prod",
				"region":   "us-east-1",
				"priority": "critical",
			}),
		),
		// Resource 2: prod + us-east-1 (matches d1 and environment)
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{
				"env":    "prod",
				"region": "us-east-1",
			}),
		),
		// Resource 3: critical + us-west (matches d2 but not environment)
		integration.WithResource(
			integration.ResourceID(r3Id),
			integration.ResourceMetadata(map[string]string{
				"priority": "critical",
				"region":   "us-west-1",
			}),
		),
	)
	ctx := context.Background()

	r3, _ := engine.Workspace().Resources().Get(r3Id)

	// Expected release targets:
	// - r1 matches d1 + e1 = 1 release target
	// - r1 matches d2 + e1 = 1 release target
	// - r2 matches d1 + e1 = 1 release target
	// - r3 matches d2 but not e1 (region mismatch) = 0 release targets
	// Total = 3 release targets
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets with complex selectors, got %d", len(releaseTargets))
	}

	// Update resource 3 to match the environment selector
	r3.Metadata["region"] = "us-east-1"
	engine.PushEvent(ctx, handler.ResourceUpdate, r3)

	// Now r3 should create 1 more release target
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets after updating r3, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetEnvironmentWithoutSelector(t *testing.T) {
	envId := "env-1"
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(),
			integration.WithEnvironment(
				integration.EnvironmentID(envId),
				integration.EnvironmentNoResourceSelector(),
			),
		),
		integration.WithResource(),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	e1, _ := engine.Workspace().Environments().Get(envId)

	// Verify NO release targets are created because environment has no selector
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets (environment without selector should match no resources), got %d", len(releaseTargets))
	}

	// Now add a selector to the environment to match all resources
	e1.ResourceSelector = c.NewJsonSelector(map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	})
	engine.PushEvent(ctx, handler.EnvironmentUpdate, e1)

	// Now release targets should be created
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets after adding environment selector, got %d", len(releaseTargets))
	}
}

func TestEngine_ReleaseTargetSystemDeletion(t *testing.T) {
	sysId := "sys-1"
	d1Id := "d1-1"
	e1Id := "e1-1"
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sysId),
			integration.SystemName("test-system"),
			integration.WithDeployment(integration.DeploymentID(d1Id)),
			integration.WithEnvironment(integration.EnvironmentID(e1Id)),
		),
		integration.WithResource(),
		integration.WithResource(),
	)
	ctx := context.Background()

	sys, _ := engine.Workspace().Systems().Get(sysId)
	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)

	// Verify release targets were created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Delete the system - should remove all associated deployments, environments, and release targets
	engine.PushEvent(ctx, handler.SystemDelete, sys)

	// Verify all release targets are removed
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
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
	sysId := "sys-id"
	d1Id := "d1-id"
	d2Id := "d2-id"
	e1Id := "e1-id"
	e2Id := "e2-id"
	r1Id := "r1-id"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sysId),
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
				integration.DeploymentName("deployment-1"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2Id),
				integration.DeploymentName("deployment-2"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
				integration.EnvironmentName("env-1"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2Id),
				integration.EnvironmentName("env-2"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1Id),
			integration.ResourceName("resource-1"),
		),
	)
	ctx := context.Background()

	sys, _ := engine.Workspace().Systems().Get(sysId)
	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	d2, _ := engine.Workspace().Deployments().Get(d2Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)
	e2, _ := engine.Workspace().Environments().Get(e2Id)
	r1, _ := engine.Workspace().Resources().Get(r1Id)

	// Expected: 2 deployments × 2 environments × 1 resource = 4 release targets
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets (2×2×1), got %d", len(releaseTargets))
	}

	// Delete one deployment - should remove 2 release targets (d2 × 2 environments)
	engine.PushEvent(ctx, handler.DeploymentDelete, d2)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
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

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after deleting environment, got %d", len(releaseTargets))
	}

	// Verify the remaining release target is for d1 + e1 + r1
	var rt *oapi.ReleaseTarget
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

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deleting all deployments, got %d", len(releaseTargets))
	}

	// Recreate deployment
	d3 := c.NewDeployment(sys.Id)
	d3.Name = "deployment-3"
	engine.PushEvent(ctx, handler.DeploymentCreate, d3)

	// Should have 1 release target now (d3 × e1 × r1)
	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target after recreating deployment, got %d", len(releaseTargets))
	}

	// Delete the remaining environment - should remove all release targets
	engine.PushEvent(ctx, handler.EnvironmentDelete, e1)

	releaseTargets, _ = engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 0 {
		t.Fatalf("expected 0 release targets after deleting all environments, got %d", len(releaseTargets))
	}
}
