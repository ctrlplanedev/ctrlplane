package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_DeploymentCreation(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID

	d1 := c.NewDeployment()
	d1.Name = "deployment-has-filter"
	d1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	})

	d2 := c.NewDeployment()
	d2.Name = "deployment-has-no-filter"

	ctx := context.Background()

	engine.PushEvent(ctx, handler.DeploymentCreate, d1)
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	engineD1, _ := engine.Workspace().Deployments().Get(d1.Id)
	engineD2, _ := engine.Workspace().Deployments().Get(d2.Id)

	if engineD1.Id != d1.Id {
		t.Fatalf("deployments have the same id")
	}

	if engineD2.Id != d2.Id {
		t.Fatalf("deployments have the same id")
	}

	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)

	if len(releaseTargets) != 0 {
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	r1 := c.NewResource(workspaceID)
	r1.Metadata["env"] = "dev"

	r2 := c.NewResource(workspaceID)
	r2.Metadata["env"] = "qa"

	engine.PushEvent(ctx, handler.ResourceCreate, r1)
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)

	if len(releaseTargets) != 0 {
		// We have no environments yet, so no release targets
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	d1Resources := engine.Workspace().Deployments().Resources(d1.Id)

	if len(d1Resources) != 1 {
		t.Fatalf("resources count is %d, want 1", len(d1Resources))
	}

	d2Resources := engine.Workspace().Deployments().Resources(d2.Id)

	if len(d2Resources) != 2 {
		t.Fatalf("resources count is %d, want 2", len(d2Resources))
	}
}

func BenchmarkEngine_DeploymentCreation(b *testing.B) {
	engine := integration.NewTestEngine(nil)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	for range 100 {
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewResource(workspaceID))
	}

	b.ResetTimer()
	for b.Loop() {
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewDeployment())
	}
}
