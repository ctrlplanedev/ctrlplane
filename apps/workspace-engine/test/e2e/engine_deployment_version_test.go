package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/test/e2e/creators"
	"workspace-engine/test/integration"
)

func TestEngine_DeploymentVersionCreation(t *testing.T) {
	engine := integration.NewTestEngine(t)
	dv1 := creators.NewDeploymentVersion()
	dv2 := creators.NewDeploymentVersion()
	ctx := context.Background()

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	engineDv1, _ := engine.Workspace().DeploymentVersions().Get(dv1.Id)
	engineDv2, _ := engine.Workspace().DeploymentVersions().Get(dv2.Id)

	if engineDv1.Id != dv1.Id {
		t.Fatalf("deployment versions have the same id")
	}

	if engineDv2.Id != dv2.Id {
		t.Fatalf("deployment versions have the same id")
	}
}

func BenchmarkEngine_DeploymentVersionCreation(b *testing.B) {
	engine := integration.NewTestEngine(nil)

	const numVersions = 1

	versions := make([]*pb.DeploymentVersion, numVersions)
	for i := range versions {
		versions[i] = creators.NewDeploymentVersion()
	}

	ctx := context.Background()

	b.ResetTimer()
	for b.Loop() {
		for _, dv := range versions {
			engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)
		}
	}
}
