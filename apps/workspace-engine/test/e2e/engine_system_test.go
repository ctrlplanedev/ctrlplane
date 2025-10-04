package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	c "workspace-engine/test/e2e/creators"
	"workspace-engine/test/integration"
)

func TestEngine_SystemWithMaterializedViews(t *testing.T) {
	engine := integration.NewTestEngine(t)
	ctx := context.Background()

	// Create systems
	s1 := c.NewSystem()
	s1.Name = "system-1"
	s2 := c.NewSystem()
	s2.Name = "system-2"

	engine.PushEvent(ctx, handler.SystemCreate, s1)
	engine.PushEvent(ctx, handler.SystemCreate, s2)

	// Verify systems were created
	engineS1, ok := engine.Workspace().Systems().Get(s1.Id)
	if !ok {
		t.Fatalf("system s1 not found")
	}
	if engineS1.Id != s1.Id {
		t.Fatalf("system s1 id mismatch: got %s, want %s", engineS1.Id, s1.Id)
	}

	engineS2, ok := engine.Workspace().Systems().Get(s2.Id)
	if !ok {
		t.Fatalf("system s2 not found")
	}
	if engineS2.Id != s2.Id {
		t.Fatalf("system s2 id mismatch: got %s, want %s", engineS2.Id, s2.Id)
	}

	// Initially, systems should have no deployments
	s1Deployments := engine.Workspace().Systems().Deployments(s1.Id)
	if len(s1Deployments) != 0 {
		t.Fatalf("system s1 deployments count is %d, want 0", len(s1Deployments))
	}

	// Initially, systems should have no environments
	s1Environments := engine.Workspace().Systems().Environments(s1.Id)
	if len(s1Environments) != 0 {
		t.Fatalf("system s1 environments count is %d, want 0", len(s1Environments))
	}

	// Create deployments for system 1
	d1 := c.NewDeployment()
	d1.Name = "deployment-1-s1"
	d1.SystemId = s1.Id
	
	d2 := c.NewDeployment()
	d2.Name = "deployment-2-s1"
	d2.SystemId = s1.Id
	d2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})

	// Create deployments for system 2
	d3 := c.NewDeployment()
	d3.Name = "deployment-1-s2"
	d3.SystemId = s2.Id

	engine.PushEvent(ctx, handler.DeploymentCreate, d1)
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)
	engine.PushEvent(ctx, handler.DeploymentCreate, d3)

	// Verify materialized view for system 1 deployments
	s1Deployments = engine.Workspace().Systems().Deployments(s1.Id)
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

	// Create environments for system 1
	e1 := c.NewEnvironment()
	e1.Name = "environment-dev-s1"
	e1.SystemId = s1.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	})

	e2 := c.NewEnvironment()
	e2.Name = "environment-prod-s1"
	e2.SystemId = s1.Id
	e2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	})

	// Create environments for system 2
	e3 := c.NewEnvironment()
	e3.Name = "environment-staging-s2"
	e3.SystemId = s2.Id

	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)
	engine.PushEvent(ctx, handler.EnvironmentCreate, e3)

	// Verify materialized view for system 1 environments
	s1Environments = engine.Workspace().Systems().Environments(s1.Id)
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

	// Update a deployment to move it to system 2
	d1.SystemId = s2.Id
	engine.PushEvent(ctx, handler.DeploymentUpdate, d1)

	// Verify materialized views updated - system 1 should now have 1 deployment
	s1Deployments = engine.Workspace().Systems().Deployments(s1.Id)
	if len(s1Deployments) != 1 {
		t.Fatalf("after update, system s1 deployments count is %d, want 1", len(s1Deployments))
	}

	if _, ok := s1Deployments[d1.Id]; ok {
		t.Fatalf("deployment d1 should not be in system s1 materialized view after update")
	}

	// System 2 should now have 2 deployments
	s2Deployments = engine.Workspace().Systems().Deployments(s2.Id)
	if len(s2Deployments) != 2 {
		t.Fatalf("after update, system s2 deployments count is %d, want 2", len(s2Deployments))
	}

	if _, ok := s2Deployments[d1.Id]; !ok {
		t.Fatalf("deployment d1 should be in system s2 materialized view after update")
	}

	// Update an environment to move it to system 2
	e1.SystemId = s2.Id
	engine.PushEvent(ctx, handler.EnvironmentUpdate, e1)

	// Verify materialized views updated - system 1 should now have 1 environment
	s1Environments = engine.Workspace().Systems().Environments(s1.Id)
	if len(s1Environments) != 1 {
		t.Fatalf("after update, system s1 environments count is %d, want 1", len(s1Environments))
	}

	if _, ok := s1Environments[e1.Id]; ok {
		t.Fatalf("environment e1 should not be in system s1 materialized view after update")
	}

	// System 2 should now have 2 environments
	s2Environments = engine.Workspace().Systems().Environments(s2.Id)
	if len(s2Environments) != 2 {
		t.Fatalf("after update, system s2 environments count is %d, want 2", len(s2Environments))
	}

	if _, ok := s2Environments[e1.Id]; !ok {
		t.Fatalf("environment e1 should be in system s2 materialized view after update")
	}

	// Test system deletion - should remove associated deployments and environments
	engine.PushEvent(ctx, handler.SystemDelete, s1)

	// Verify system 1 is removed
	if engine.Workspace().Systems().Has(s1.Id) {
		t.Fatalf("system s1 should be removed")
	}

	// Verify deployments associated with system 1 are removed
	if _, ok := engine.Workspace().Deployments().Get(d2.Id); ok {
		t.Fatalf("deployment d2 should be removed when system s1 is deleted")
	}

	// Verify environments associated with system 1 are removed
	if _, ok := engine.Workspace().Environments().Get(e2.Id); ok {
		t.Fatalf("environment e2 should be removed when system s1 is deleted")
	}

	// Verify system 2 still exists with correct data
	s2Deployments = engine.Workspace().Systems().Deployments(s2.Id)
	if len(s2Deployments) != 2 {
		t.Fatalf("after s1 deletion, system s2 deployments count is %d, want 2", len(s2Deployments))
	}

	s2Environments = engine.Workspace().Systems().Environments(s2.Id)
	if len(s2Environments) != 2 {
		t.Fatalf("after s1 deletion, system s2 environments count is %d, want 2", len(s2Environments))
	}
}

func TestEngine_SystemMaterializedViewsWithResources(t *testing.T) {
	engine := integration.NewTestEngine(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem()
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create deployments for the system
	d1 := c.NewDeployment()
	d1.Name = "deployment-all"
	d1.SystemId = sys.Id

	d2 := c.NewDeployment()
	d2.Name = "deployment-filtered"
	d2.SystemId = sys.Id

	d2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "critical",
		"key":      "priority",
	})

	engine.PushEvent(ctx, handler.DeploymentCreate, d1)
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create environments for the system
	e1 := c.NewEnvironment()
	e1.Name = "env-dev"
	e1.SystemId = sys.Id
	e1.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "stage",
	})

	e2 := c.NewEnvironment()
	e2.Name = "env-prod"
	e2.SystemId = sys.Id
	e2.ResourceSelector = c.MustNewStructFromMap(map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "stage",
	})

	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)

	// Create resources
	r1 := c.NewResource(workspaceID)
	r1.Metadata = map[string]string{
		"stage":    "dev",
		"priority": "normal",
	}
	r2 := c.NewResource(workspaceID)
	r2.Metadata = map[string]string{
		"stage":    "prod",
		"priority": "critical",
	}

	engine.PushEvent(ctx, handler.ResourceCreate, r1)
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Verify system has correct deployments and environments
	sysDeployments := engine.Workspace().Systems().Deployments(sys.Id)
	if len(sysDeployments) != 2 {
		t.Fatalf("system deployments count is %d, want 2", len(sysDeployments))
	}

	sysEnvironments := engine.Workspace().Systems().Environments(sys.Id)
	if len(sysEnvironments) != 2 {
		t.Fatalf("system environments count is %d, want 2", len(sysEnvironments))
	}

	// Verify release targets are created correctly
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	
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

