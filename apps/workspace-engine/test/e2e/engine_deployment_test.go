package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_DeploymentCreation(t *testing.T) {
	deploymentID1 := "1"
	deploymentID2 := "2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-has-filter"),
				integration.DeploymentResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "dev",
					"key":      "env",
				}),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-has-no-filter"),
			),
		),
	)

	engineD1, _ := engine.Workspace().Deployments().Get(deploymentID1)
	engineD2, _ := engine.Workspace().Deployments().Get(deploymentID2)

	if engineD1.Id != deploymentID1 {
		t.Fatalf("deployments have the same id")
	}

	if engineD2.Id != deploymentID2 {
		t.Fatalf("deployments have the same id")
	}

	ctx := context.Background()
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)

	if len(releaseTargets) != 0 {
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	engine = engine.With(
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "qa"}),
		),
	)

	releaseTargets = engine.Workspace().ReleaseTargets().Items(ctx)

	if len(releaseTargets) != 0 {
		// We have no environments yet, so no release targets
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	d1Resources := engine.Workspace().Deployments().Resources(deploymentID1)
	d2Resources := engine.Workspace().Deployments().Resources(deploymentID2)

	if len(d1Resources) != 1 {
		t.Fatalf("resources count is %d, want 1", len(d1Resources))
	}

	if len(d2Resources) != 2 {
		t.Fatalf("resources count is %d, want 2", len(d2Resources))
	}
}

func BenchmarkEngine_DeploymentCreation(b *testing.B) {
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	for range 100 {
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewResource(workspaceID))
	}

	b.ResetTimer()
	for b.Loop() {
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewDeployment(workspaceID))
	}
}
