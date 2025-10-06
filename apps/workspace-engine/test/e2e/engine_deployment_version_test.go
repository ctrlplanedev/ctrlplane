package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/test/integration"
	"workspace-engine/test/integration/creators"
)

func TestEngine_DeploymentVersionCreation(t *testing.T) {
	dv1Id := "dv1"
	dv2Id := "dv2"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(integration.DeploymentVersionID(dv1Id)),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(dv2Id)),
			),
		),
	)

	engineDv1, _ := engine.Workspace().DeploymentVersions().Get(dv1Id)
	engineDv2, _ := engine.Workspace().DeploymentVersions().Get(dv2Id)

	if engineDv1.Id != dv1Id {
		t.Fatalf("deployment versions have the same id")
	}

	if engineDv2.Id != dv2Id {
		t.Fatalf("deployment versions have the same id")
	}
}

func BenchmarkEngine_DeploymentVersionCreation(b *testing.B) {
	engine := integration.NewTestWorkspace(nil)

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
