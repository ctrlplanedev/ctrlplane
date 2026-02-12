package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

func TestEngine_SystemInitialState(t *testing.T) {
	systemId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
		),
	)

	system, _ := engine.Workspace().Systems().Get(systemId)

	// Initially, systems should have no deployments
	deployments := engine.Workspace().Deployments().Items()
	if len(deployments) != 0 {
		t.Fatalf("system deployments count is %d, want 0", len(deployments))
	}

	// Initially, systems should have no environments
	environments := engine.Workspace().Systems().Environments(system.Id)
	if len(environments) != 0 {
		t.Fatalf("system environments count is %d, want 0", len(environments))
	}
}

func TestEngine_SystemDeploymentMaterializedViews(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)

	// Create deployments for system 1
	d1 := c.NewDeployment(s1.Id)
	d1.Name = "deployment-1-s1"

	d2 := c.NewDeployment(s1.Id)
	d2.Name = "deployment-2-s1"

	// Create deployment for system 2
	d3 := c.NewDeployment(s2.Id)
	d3.Name = "deployment-1-s2"

	engine.PushEvent(ctx, handler.DeploymentCreate, d1)
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)
	engine.PushEvent(ctx, handler.DeploymentCreate, d3)

	// Verify materialized view for system 1 deployments
	s1Deployments := engine.Workspace().Systems().Deployments(s1.Id)
	if len(s1Deployments) != 2 {
		t.Fatalf("system s1 deployments count is %d, want 2", len(s1Deployments))
	}

	if _, ok := s1Deployments[d1.Id]; !ok {
		t.Fatalf("deployment d1 not found in system s1 materialized view")
	}
	if _, ok := s1Deployments[d2.Id]; !ok {
		t.Fatalf("deployment d2 not found in system s1 materialized view")
	}

	// Verify materialized view for system 2 deployments
	s2Deployments := engine.Workspace().Systems().Deployments(s2.Id)
	if len(s2Deployments) != 1 {
		t.Fatalf("system s2 deployments count is %d, want 1", len(s2Deployments))
	}

	if _, ok := s2Deployments[d3.Id]; !ok {
		t.Fatalf("deployment d3 not found in system s2 materialized view")
	}
}

func TestEngine_SystemEnvironmentMaterializedViews(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)

	// Create environments for system 1
	e1 := c.NewEnvironment(s1.Id)
	e1.Name = "environment-dev-s1"
	e1.ResourceSelector = c.NewJsonSelector(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	})

	e2 := c.NewEnvironment(s1.Id)
	e2.Name = "environment-prod-s1"
	e2.ResourceSelector = c.NewJsonSelector(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})

	// Create environment for system 2
	e3 := c.NewEnvironment(s2.Id)
	e3.Name = "environment-staging-s2"

	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)
	engine.PushEvent(ctx, handler.EnvironmentCreate, e3)

	// Verify materialized view for system 1 environments
	s1Environments := engine.Workspace().Systems().Environments(s1.Id)
	if len(s1Environments) != 2 {
		t.Fatalf("system s1 environments count is %d, want 2", len(s1Environments))
	}

	if _, ok := s1Environments[e1.Id]; !ok {
		t.Fatalf("environment e1 not found in system s1 materialized view")
	}
	if _, ok := s1Environments[e2.Id]; !ok {
		t.Fatalf("environment e2 not found in system s1 materialized view")
	}

	// Verify materialized view for system 2 environments
	s2Environments := engine.Workspace().Systems().Environments(s2.Id)
	if len(s2Environments) != 1 {
		t.Fatalf("system s2 environments count is %d, want 1", len(s2Environments))
	}

	if _, ok := s2Environments[e3.Id]; !ok {
		t.Fatalf("environment e3 not found in system s2 materialized view")
	}
}

func TestEngine_SystemDeploymentUpdateMaterializedViews(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	d1Id := uuid.New().String()
	d2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(
				integration.DeploymentID(d1Id),
			),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithDeployment(
				integration.DeploymentID(d2Id),
			),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)
	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	// d2, _ := engine.Workspace().Deployments().Get(d2Id)

	// Update deployment d1 to move it to system 2
	newD1 := c.NewDeployment(s1.Id)
	newD1.Id = d1.Id
	newD1.SystemId = s2.Id
	engine.PushEvent(ctx, handler.DeploymentUpdate, newD1)

	// System 2 should now have 2 deployment
	s1Deployments := engine.Workspace().Systems().Deployments(s1.Id)
	if len(s1Deployments) != 0 {
		t.Fatalf("after update, system 1 deployments count is %d, want 0", len(s1Deployments))
	}

	if _, ok := s1Deployments[d1.Id]; ok {
		t.Fatalf("deployment d1 should not be in system s1 materialized view after update")
	}

	// System 2 should now have 1 deployment
	s2Deployments := engine.Workspace().Systems().Deployments(s2.Id)
	if len(s2Deployments) != 2 {
		t.Fatalf("after update, system s2 deployments count is %d, want 2", len(s2Deployments))
	}

	if _, ok := s2Deployments[d1.Id]; !ok {
		t.Fatalf("deployment d1 should be in system s2 materialized view after update")
	}
}

func TestEngine_SystemEnvironmentUpdateMaterializedViews(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	e1Id := uuid.New().String()
	e2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(e1Id),
			),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithEnvironment(
				integration.EnvironmentID(e2Id),
			),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)
	// e2, _ := engine.Workspace().Environments().Get(e2Id)

	// Update environment e1 to move it to system 2
	newE1 := c.NewEnvironment(s1.Id)
	newE1.Id = e1.Id
	newE1.SystemId = s2.Id
	engine.PushEvent(ctx, handler.EnvironmentUpdate, newE1)

	// Verify materialized views updated - system 1 should now have 1 environment
	s1Environments := engine.Workspace().Systems().Environments(s1.Id)
	if len(s1Environments) != 0 {
		t.Fatalf("after update, system s1 environments count is %d, want 0", len(s1Environments))
	}

	if _, ok := s1Environments[e1.Id]; ok {
		t.Fatalf("environment e1 should not be in system s1 materialized view after update")
	}

	// System 2 should now have 2 environment
	s2Environments := engine.Workspace().Systems().Environments(s2.Id)
	if len(s2Environments) != 2 {
		t.Fatalf("after update, system s2 environments count is %d, want 2", len(s2Environments))
	}

	if _, ok := s2Environments[e1.Id]; !ok {
		t.Fatalf("environment e1 should be in system s2 materialized view after update")
	}
}

func TestEngine_SystemDeletionCascade(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	d1Id := uuid.New().String()
	d2Id := uuid.New().String()

	e1Id := uuid.New().String()
	e2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(integration.DeploymentID(d1Id)),
			integration.WithDeployment(integration.DeploymentID(d2Id)),
			integration.WithEnvironment(integration.EnvironmentID(e1Id)),
			integration.WithEnvironment(integration.EnvironmentID(e2Id)),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithDeployment(),
			integration.WithEnvironment(),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)
	d1, _ := engine.Workspace().Deployments().Get(d1Id)
	// d2, _ := engine.Workspace().Deployments().Get(d2Id)
	e1, _ := engine.Workspace().Environments().Get(e1Id)
	// e2, _ := engine.Workspace().Environments().Get(e2Id)

	// Delete system 1
	engine.PushEvent(ctx, handler.SystemDelete, s1)

	// Verify system 1 is removed
	if _, ok := engine.Workspace().Systems().Get(s1.Id); ok {
		t.Fatalf("system s1 should be removed")
	}

	// Verify deployments associated with system 1 are removed
	if _, ok := engine.Workspace().Deployments().Get(d1.Id); ok {
		t.Fatalf("deployment d1 should be removed when system s1 is deleted")
	}

	// Verify environments associated with system 1 are removed
	if _, ok := engine.Workspace().Environments().Get(e1.Id); ok {
		t.Fatalf("environment e1 should be removed when system s1 is deleted")
	}

	// Verify system 2 still exists with correct data
	if _, ok := engine.Workspace().Systems().Get(s2.Id); !ok {
		t.Fatalf("system s2 should still exist")
	}

	s2Deployments := engine.Workspace().Systems().Deployments(s2.Id)
	if len(s2Deployments) != 1 {
		t.Fatalf("after s1 deletion, system s2 deployments count is %d, want 1", len(s2Deployments))
	}

	s2Environments := engine.Workspace().Systems().Environments(s2.Id)
	if len(s2Environments) != 1 {
		t.Fatalf("after s1 deletion, system s2 environments count is %d, want 1", len(s2Environments))
	}
}

func TestEngine_SystemMaterializedViewsWithResources(t *testing.T) {
	systemId := uuid.New().String()
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "critical",
					"key":      "priority",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "dev",
					"key":      "stage",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "prod",
					"key":      "stage",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{
				"stage":    "dev",
				"priority": "normal",
			}),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{
				"stage":    "prod",
				"priority": "critical",
			}),
		),
	)

	// Verify system has correct deployments and environments
	sysDeployments := engine.Workspace().Systems().Deployments(systemId)
	if len(sysDeployments) != 2 {
		t.Fatalf("system deployments count is %d, want 2", len(sysDeployments))
	}

	sysEnvironments := engine.Workspace().Systems().Environments(systemId)
	if len(sysEnvironments) != 2 {
		t.Fatalf("system environments count is %d, want 2", len(sysEnvironments))
	}

	// Verify release targets are created correctly
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()

	// Expected:
	// - d1 (no filter) matches both r1 and r2 = 2 resources
	// - d2 (priority=critical) matches only r2 = 1 resource
	// Total deployments * matching resources = 3 deployment-resource pairs
	//
	// - e1 (stage=dev) matches r1
	// - e2 (stage=prod) matches r2
	// Total environments * matching resources = 2 environment-resource pairs
	//
	// Release targets = deployments * environments * matching resources
	// For each deployment-resource pair, check if there's an environment-resource pair for the same resource
	// - d1+r1 can pair with e1+r1 = 1 release target
	// - d1+r2 can pair with e2+r2 = 1 release target
	// - d2+r2 can pair with e2+r2 = 1 release target
	// Total = 3 release targets
	expectedReleaseTargets := 3
	if len(releaseTargets) != expectedReleaseTargets {
		t.Fatalf("release targets count is %d, want %d", len(releaseTargets), expectedReleaseTargets)
	}

	// Verify all release targets belong to the system's deployments and environments
	for _, rt := range releaseTargets {
		if _, ok := sysDeployments[rt.DeploymentId]; !ok {
			t.Fatalf("release target deployment %s not in system deployments", rt.DeploymentId)
		}
		if _, ok := sysEnvironments[rt.EnvironmentId]; !ok {
			t.Fatalf("release target environment %s not in system environments", rt.EnvironmentId)
		}
	}
}

func TestEngine_SystemDeleteSimple(t *testing.T) {
	systemId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
		),
	)

	ctx := context.Background()
	system, _ := engine.Workspace().Systems().Get(systemId)

	// Verify system exists
	if _, ok := engine.Workspace().Systems().Get(systemId); !ok {
		t.Fatalf("system should exist before deletion")
	}

	// Delete the system
	engine.PushEvent(ctx, handler.SystemDelete, system)

	// Verify system is removed
	if _, ok := engine.Workspace().Systems().Get(systemId); ok {
		t.Fatalf("system should be removed after deletion")
	}

	// Verify Get returns not found
	if _, ok := engine.Workspace().Systems().Get(systemId); ok {
		t.Fatalf("Get should return not found after deletion")
	}
}

func TestEngine_SystemDeleteWithReleaseTargets(t *testing.T) {
	systemId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{
				"env": "prod",
			}),
		),
	)

	ctx := context.Background()
	system, _ := engine.Workspace().Systems().Get(systemId)

	// Verify release targets exist before deletion
	releaseTargetsBefore, _ := engine.Workspace().ReleaseTargets().Items()
	if len(releaseTargetsBefore) == 0 {
		t.Fatalf("expected at least one release target before deletion")
	}

	// Delete the system
	engine.PushEvent(ctx, handler.SystemDelete, system)

	// Verify system is removed
	if _, ok := engine.Workspace().Systems().Get(systemId); ok {
		t.Fatalf("system should be removed after deletion")
	}

	// Verify all release targets are removed
	releaseTargetsAfter, _ := engine.Workspace().ReleaseTargets().Items()
	if len(releaseTargetsAfter) != 0 {
		t.Fatalf("all release targets should be removed after system deletion, got %d", len(releaseTargetsAfter))
	}
}

func TestEngine_SystemDeleteMultiple(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	s3Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithDeployment(),
		),
		integration.WithSystem(
			integration.SystemID(s3Id),
			integration.SystemName("system-3"),
			integration.WithDeployment(),
		),
	)

	ctx := context.Background()
	s1, _ := engine.Workspace().Systems().Get(s1Id)
	s2, _ := engine.Workspace().Systems().Get(s2Id)

	// Verify all systems exist
	if _, ok := engine.Workspace().Systems().Get(s1Id); !ok {
		t.Fatalf("system s1 should exist")
	}
	if _, ok := engine.Workspace().Systems().Get(s2Id); !ok {
		t.Fatalf("system s2 should exist")
	}
	if _, ok := engine.Workspace().Systems().Get(s3Id); !ok {
		t.Fatalf("system s3 should exist")
	}

	// Delete system 1
	engine.PushEvent(ctx, handler.SystemDelete, s1)

	// Verify only system 1 is removed
	if _, ok := engine.Workspace().Systems().Get(s1Id); ok {
		t.Fatalf("system s1 should be removed")
	}
	if _, ok := engine.Workspace().Systems().Get(s2Id); !ok {
		t.Fatalf("system s2 should still exist")
	}
	if _, ok := engine.Workspace().Systems().Get(s3Id); !ok {
		t.Fatalf("system s3 should still exist")
	}

	// Delete system 2
	engine.PushEvent(ctx, handler.SystemDelete, s2)

	// Verify system 2 is also removed, system 3 remains
	if _, ok := engine.Workspace().Systems().Get(s1Id); ok {
		t.Fatalf("system s1 should still be removed")
	}
	if _, ok := engine.Workspace().Systems().Get(s2Id); ok {
		t.Fatalf("system s2 should be removed")
	}
	if _, ok := engine.Workspace().Systems().Get(s3Id); !ok {
		t.Fatalf("system s3 should still exist")
	}
}

func TestEngine_SystemDeleteOnlyDeployments(t *testing.T) {
	systemId := uuid.New().String()
	d1Id := uuid.New().String()
	d2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
			integration.WithDeployment(integration.DeploymentID(d1Id)),
			integration.WithDeployment(integration.DeploymentID(d2Id)),
		),
	)

	ctx := context.Background()
	system, _ := engine.Workspace().Systems().Get(systemId)

	// Verify deployments exist
	if _, ok := engine.Workspace().Deployments().Get(d1Id); !ok {
		t.Fatalf("deployment d1 should exist")
	}
	if _, ok := engine.Workspace().Deployments().Get(d2Id); !ok {
		t.Fatalf("deployment d2 should exist")
	}

	// Delete the system
	engine.PushEvent(ctx, handler.SystemDelete, system)

	// Verify system is removed
	if _, ok := engine.Workspace().Systems().Get(systemId); ok {
		t.Fatalf("system should be removed")
	}

	// Verify all deployments are removed
	if _, ok := engine.Workspace().Deployments().Get(d1Id); ok {
		t.Fatalf("deployment d1 should be removed")
	}
	if _, ok := engine.Workspace().Deployments().Get(d2Id); ok {
		t.Fatalf("deployment d2 should be removed")
	}
}

func TestEngine_SystemDeleteOnlyEnvironments(t *testing.T) {
	systemId := uuid.New().String()
	e1Id := uuid.New().String()
	e2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
			integration.WithEnvironment(integration.EnvironmentID(e1Id)),
			integration.WithEnvironment(integration.EnvironmentID(e2Id)),
		),
	)

	ctx := context.Background()
	system, _ := engine.Workspace().Systems().Get(systemId)

	// Verify environments exist
	if _, ok := engine.Workspace().Environments().Get(e1Id); !ok {
		t.Fatalf("environment e1 should exist")
	}
	if _, ok := engine.Workspace().Environments().Get(e2Id); !ok {
		t.Fatalf("environment e2 should exist")
	}

	// Delete the system
	engine.PushEvent(ctx, handler.SystemDelete, system)

	// Verify system is removed
	if _, ok := engine.Workspace().Systems().Get(systemId); ok {
		t.Fatalf("system should be removed")
	}

	// Verify all environments are removed
	if _, ok := engine.Workspace().Environments().Get(e1Id); ok {
		t.Fatalf("environment e1 should be removed")
	}
	if _, ok := engine.Workspace().Environments().Get(e2Id); ok {
		t.Fatalf("environment e2 should be removed")
	}
}
