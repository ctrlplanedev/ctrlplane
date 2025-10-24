package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_PolicyBasicReleaseTargets(t *testing.T) {
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentName("deployment-1"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-prod"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("policy-all"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Verify release target was created
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Get the single release target
	var rt *oapi.ReleaseTarget
	for _, target := range releaseTargets {
		rt = target
		break
	}

	// Verify the policy matches the release target
	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt)
	if len(policies) != 1 {
		t.Fatalf("expected policy to match 1 release target, got %d", len(policies))
	}
}

func TestEngine_PolicyDeploymentSelector(t *testing.T) {
	d1ID := "d1-1"
	d2ID := "d2-1"
	e1ID := "e1-1"
	r1ID := "r1-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-dev"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentName("env-prod"),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
		integration.WithPolicy(
			integration.PolicyName("policy-prod-only"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "prod",
				}),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Verify 2 release targets were created (d1+e1+r1 and d2+e1+r1)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Check which release targets match the policy
	rtProd := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rtDev := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	// Verify policy matches prod release target
	policiesProd, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtProd)
	if len(policiesProd) != 1 {
		t.Fatalf("expected policy to match prod release target, got %d policies", len(policiesProd))
	}

	// Verify policy does NOT match dev release target
	policiesDev, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtDev)
	if len(policiesDev) != 0 {
		t.Fatalf("expected policy NOT to match dev release target, got %d policies", len(policiesDev))
	}
}

func TestEngine_PolicyEnvironmentSelector(t *testing.T) {
	d1ID := "d1-1"
	e1ID := "e1-1"
	r1ID := "r1-1"
	e2ID := "e2-2"
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentName("env-us-east"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2ID),
				integration.EnvironmentName("env-us-west"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
	)

	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	d1, _ := engine.Workspace().Deployments().Get(d1ID)
	e1, _ := engine.Workspace().Environments().Get(e1ID)
	e2, _ := engine.Workspace().Environments().Get(e2ID)
	r1, _ := engine.Workspace().Resources().Get(r1ID)

	// Verify 2 release targets were created
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Create a policy that only matches us-east environments by name
	policy := c.NewPolicy(workspaceID)
	policy.Name = "policy-us-east-only"
	selector := c.NewPolicyTargetSelector()
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "east",
	}})
	selector.EnvironmentSelector = envSelector
	selector.DeploymentSelector = &oapi.Selector{}
	_ = selector.DeploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	selector.ResourceSelector = &oapi.Selector{}
	_ = selector.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)


	// Check which release targets match the policy
	rtEast := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}
	rtWest := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e2.Id,
		ResourceId:    r1.Id,
	}

	// Verify policy matches us-east release target
	policiesEast, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtEast)
	if len(policiesEast) != 1 {
		t.Fatalf("expected policy to match us-east release target, got %d policies", len(policiesEast))
	}

	// Verify policy does NOT match us-west release target
	policiesWest, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtWest)
	if len(policiesWest) != 0 {
		t.Fatalf("expected policy NOT to match us-west release target, got %d policies", len(policiesWest))
	}
}

func TestEngine_PolicyResourceSelector(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment(sys.Id)
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create two resources with different metadata
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-critical"
	r1.Metadata = map[string]string{"priority": "critical"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-normal"
	r2.Metadata = map[string]string{"priority": "normal"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Verify 2 release targets were created
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Create a policy that only matches critical resources
	policy := c.NewPolicy(workspaceID)
	policy.Name = "policy-critical-only"
	selector := c.NewPolicyTargetSelector()
	resSelector := &oapi.Selector{}
	_ = resSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"key":      "priority",
		"value":    "critical",
	}})
	selector.ResourceSelector = resSelector
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Check which release targets match the policy
	rtCritical := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	rtNormal := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r2.Id,
	}

	// Verify policy matches critical release target
	policiesCritical, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtCritical)
	if len(policiesCritical) != 1 {
		t.Fatalf("expected policy to match critical release target, got %d policies", len(policiesCritical))
	}

	// Verify policy does NOT match normal release target
	policiesNormal, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtNormal)
	if len(policiesNormal) != 0 {
		t.Fatalf("expected policy NOT to match normal release target, got %d policies", len(policiesNormal))
	}
}

func TestEngine_PolicyAllThreeSelectors(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create two deployments
	d1 := c.NewDeployment(sys.Id)
	d1.Name = "deployment-prod"
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	d2 := c.NewDeployment(sys.Id)
	d2.Name = "deployment-dev"
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create two environments
	e1 := c.NewEnvironment(sys.Id)
	e1.Name = "env-us-east"
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	e2 := c.NewEnvironment(sys.Id)
	e2.Name = "env-us-west"
	e2Selector := &oapi.Selector{}
	_ = e2Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e2.ResourceSelector = e2Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e2)

	// Create two resources
	r1 := c.NewResource(workspaceID)
	r1.Metadata = map[string]string{"priority": "critical"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Metadata = map[string]string{"priority": "normal"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Total: 2 deployments × 2 environments × 2 resources = 8 release targets
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 8 {
		t.Fatalf("expected 8 release targets, got %d", len(releaseTargets))
	}

	// Create a policy with all three selectors: prod + us-east + critical
	policy := c.NewPolicy(workspaceID)
	policy.Name = "policy-prod-east-critical"
	selector := c.NewPolicyTargetSelector()
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "prod",
	}})
	selector.DeploymentSelector = depSelector
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "east",
	}})
	selector.EnvironmentSelector = envSelector
	resSelector := &oapi.Selector{}
	_ = resSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"key":      "priority",
		"value":    "critical",
	}})
	selector.ResourceSelector = resSelector
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Only the release target with d1 + e1 + r1 should match
	rtMatch := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	// Test the matching release target
	policiesMatch, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtMatch)
	if len(policiesMatch) != 1 {
		t.Fatalf("expected policy to match prod+east+critical release target, got %d policies", len(policiesMatch))
	}

	// Test a non-matching release target (dev + us-east + critical)
	rtNoMatch := &oapi.ReleaseTarget{
		DeploymentId:  d2.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	policiesNoMatch, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtNoMatch)
	if len(policiesNoMatch) != 0 {
		t.Fatalf("expected policy NOT to match dev+east+critical release target, got %d policies", len(policiesNoMatch))
	}

	// Test another non-matching release target (prod + us-west + critical)
	rtNoMatch2 := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e2.Id,
		ResourceId:    r1.Id,
	}

	policiesNoMatch2, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtNoMatch2)
	if len(policiesNoMatch2) != 0 {
		t.Fatalf("expected policy NOT to match prod+west+critical release target, got %d policies", len(policiesNoMatch2))
	}

	// Test another non-matching release target (prod + us-east + normal)
	rtNoMatch3 := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r2.Id,
	}

	policiesNoMatch3, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtNoMatch3)
	if len(policiesNoMatch3) != 0 {
		t.Fatalf("expected policy NOT to match prod+east+normal release target, got %d policies", len(policiesNoMatch3))
	}
}

func TestEngine_PolicyMultipleSelectors(t *testing.T) {
	d1ID := "deployment-prod"
	d2ID := "deployment-staging"
	e1ID := "env-1"
	r1ID := "resource-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-staging"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
		integration.WithPolicy(
			integration.PolicyName("policy-prod-or-staging"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "prod",
				}),
			),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "staging",
				}),
			),
		),
	)

	ctx := context.Background()

	// 2 release targets should exist
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Both release targets should match the policy
	rtProd := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rtStaging := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	policiesProd, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtProd)
	if len(policiesProd) != 1 {
		t.Fatalf("expected policy to match prod release target, got %d policies", len(policiesProd))
	}

	policiesStaging, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtStaging)
	if len(policiesStaging) != 1 {
		t.Fatalf("expected policy to match staging release target, got %d policies", len(policiesStaging))
	}
}

func TestEngine_PolicyUpdate(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create two deployments
	d1 := c.NewDeployment(sys.Id)
	d1.Name = "deployment-prod"
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	d2 := c.NewDeployment(sys.Id)
	d2.Name = "deployment-dev"
	engine.PushEvent(ctx, handler.DeploymentCreate, d2)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Create a policy that matches all deployments initially
	policy := c.NewPolicy(workspaceID)
	policy.Name = "policy-all"
	selector := c.NewPolicyTargetSelector()
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Both release targets should match
	rtProd := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	rtDev := &oapi.ReleaseTarget{
		DeploymentId:  d2.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	policiesProd, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtProd)
	if len(policiesProd) != 1 {
		t.Fatalf("expected policy to match prod release target initially, got %d policies", len(policiesProd))
	}

	policiesDev, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtDev)
	if len(policiesDev) != 1 {
		t.Fatalf("expected policy to match dev release target initially, got %d policies", len(policiesDev))
	}
	// Update policy to only match prod deployments
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "prod",
	}})
	selector.DeploymentSelector = depSelector
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Now only prod should match
	policiesProdAfter, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtProd)
	if len(policiesProdAfter) != 1 {
		t.Fatalf("expected policy to match prod release target after update, got %d policies", len(policiesProdAfter))
	}

	policiesDevAfter, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtDev)
	if len(policiesDevAfter) != 0 {
		t.Fatalf("expected policy NOT to match dev release target after update, got %d policies", len(policiesDevAfter))
	}
}

func TestEngine_PolicyDelete(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment(sys.Id)
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Create a policy
	policy := c.NewPolicy(workspaceID)
	selector := c.NewPolicyTargetSelector()
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Verify policy matches the release target
	rt := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt)
	if len(policies) != 1 {
		t.Fatalf("expected 1 matching policy, got %d", len(policies))
	}

	// Delete the policy
	engine.PushEvent(ctx, handler.PolicyDelete, policy)

	// Verify policy no longer matches
	policiesAfter, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt)
	if len(policiesAfter) != 0 {
		t.Fatalf("expected 0 matching policies after deletion, got %d", len(policiesAfter))
	}

	// Verify policy is removed from store
	if engine.Workspace().Policies().Has(policy.Id) {
		t.Fatalf("policy should be removed from store after deletion")
	}
}

func TestEngine_PolicyMultiplePoliciesOneReleaseTarget(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment(sys.Id)
	d1.Name = "deployment-prod-high"
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Create policy 1 that matches prod
	policy1 := c.NewPolicy(workspaceID)
	policy1.Name = "policy-prod"
	selector1 := c.NewPolicyTargetSelector()
	dep1Selector := &oapi.Selector{}
	_ = dep1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "prod",
	}})
	selector1.DeploymentSelector = dep1Selector
	policy1.Selectors = []oapi.PolicyTargetSelector{*selector1}
	engine.PushEvent(ctx, handler.PolicyCreate, policy1)

	// Create policy 2 that matches high priority
	policy2 := c.NewPolicy(workspaceID)
	policy2.Name = "policy-high-priority"
	selector2 := c.NewPolicyTargetSelector()
	dep2Selector := &oapi.Selector{}
	_ = dep2Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "high",
	}})
	selector2.DeploymentSelector = dep2Selector
	policy2.Selectors = []oapi.PolicyTargetSelector{*selector2}
	engine.PushEvent(ctx, handler.PolicyCreate, policy2)

	// Create policy 3 that matches all
	policy3 := c.NewPolicy(workspaceID)
	policy3.Name = "policy-all"
	selector3 := c.NewPolicyTargetSelector()
	policy3.Selectors = []oapi.PolicyTargetSelector{*selector3}
	engine.PushEvent(ctx, handler.PolicyCreate, policy3)

	// The release target should match all three policies
	rt := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt)
	if len(policies) != 3 {
		t.Fatalf("expected 3 matching policies, got %d", len(policies))
	}

	// Verify all policy IDs are present
	policyIds := make(map[string]bool)
	for _, p := range policies {
		policyIds[p.Id] = true
	}

	if !policyIds[policy1.Id] {
		t.Fatalf("policy1 should match release target")
	}
	if !policyIds[policy2.Id] {
		t.Fatalf("policy2 should match release target")
	}
	if !policyIds[policy3.Id] {
		t.Fatalf("policy3 should match release target")
	}
}

func TestEngine_PolicyNoMatchingReleaseTargets(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment(sys.Id)
	d1.Name = "deployment-dev"
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Create a policy that matches prod only (won't match dev)
	policy := c.NewPolicy(workspaceID)
	policy.Name = "policy-prod-only"
	selector := c.NewPolicyTargetSelector()
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "prod",
	}})
	selector.DeploymentSelector = depSelector
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// The dev release target should NOT match the policy
	rt := &oapi.ReleaseTarget{
		DeploymentId:  d1.Id,
		EnvironmentId: e1.Id,
		ResourceId:    r1.Id,
	}

	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt)
	if len(policies) != 0 {
		t.Fatalf("expected 0 matching policies, got %d", len(policies))
	}
}

func TestEngine_PolicyWithNonExistentEntities(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	d1 := c.NewDeployment(sys.Id)
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	// Create an environment
	e1 := c.NewEnvironment(sys.Id)
	e1Selector := &oapi.Selector{}
	_ = e1Selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	e1.ResourceSelector = e1Selector
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	// Create a resource
	r1 := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Create a policy with a selector
	policy := c.NewPolicy(workspaceID)
	selector := c.NewPolicyTargetSelector()
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Test with a non-existent release target
	rtNonExistent := &oapi.ReleaseTarget{
		DeploymentId:  "non-existent-deployment",
		EnvironmentId: "non-existent-environment",
		ResourceId:    "non-existent-resource",
	}

	// Should not panic and return empty list
	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtNonExistent)
	if len(policies) != 0 {
		t.Fatalf("expected 0 matching policies for non-existent release target, got %d", len(policies))
	}
}

func TestEngine_PolicyWithComplexSelectorCombinations(t *testing.T) {
	d1ID := "d1-1"
	d2ID := "d2-1"
	d3ID := "d3-1"
	e1ID := "e1-1"
	e2ID := "e2-1"
	r1ID := "r1-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod-web"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-prod-api"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d3ID),
				integration.DeploymentName("deployment-dev-web"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentName("env-us-east"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2ID),
				integration.EnvironmentName("env-us-west"),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
		integration.WithPolicy(
			integration.PolicyName("policy-web-apps"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"operator": "and",
					"conditions": []any{
						map[string]any{
							"type":     "name",
							"operator": "contains",
							"value":    "prod",
						},
						map[string]any{
							"type":     "name",
							"operator": "contains",
							"value":    "web",
						},
					},
				}),
				integration.PolicyTargetJsonEnvironmentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "east",
				}),
			),
		),
		integration.WithPolicy(
			integration.PolicyName("policy-web-apps"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"operator": "and",
					"conditions": []any{
						map[string]any{
							"type":     "name",
							"operator": "contains",
							"value":    "dev",
						},
						map[string]any{
							"type":     "name",
							"operator": "contains",
							"value":    "web",
						},
					},
				}),
				integration.PolicyTargetJsonEnvironmentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "west",
				}),
			),
		),
	)

	ctx := context.Background()

	// Test: d1 (prod web) + e1 (us-east) + r1 should match
	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}
	policies1, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt1)
	if len(policies1) != 1 {
		t.Fatalf("expected policy to match d1+e1+r1, got %d policies", len(policies1))
	}

	// Test: d3 (dev web) + e2 (us-west) + r1 should match
	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  d3ID,
		EnvironmentId: e2ID,
		ResourceId:    r1ID,
	}
	policies2, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt2)
	if len(policies2) != 1 {
		t.Fatalf("expected policy to match d3+e2+r1, got %d policies", len(policies2))
	}

	// Test: d2 (prod api) + e1 (us-east) + r1 should NOT match (wrong app type)
	rt3 := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}
	policies3, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt3)
	if len(policies3) != 0 {
		t.Fatalf("expected policy NOT to match d2+e1+r1, got %d policies", len(policies3))
	}

	// Test: d1 (prod web) + e2 (us-west) + r1 should NOT match (wrong region)
	rt4 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e2ID,
		ResourceId:    r1ID,
	}
	policies4, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rt4)
	if len(policies4) != 0 {
		t.Fatalf("expected policy NOT to match d1+e2+r1, got %d policies", len(policies4))
	}
}

func TestEngine_ReleaseTargetCreatedAfterPolicy(t *testing.T) {
	d1ID := "deployment-prod"
	d2ID := "deployment-staging"
	e1ID := "env-1"
	r1ID := "resource-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithPolicy(
			integration.PolicyName("policy-prod-or-staging"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "prod",
				}),
			),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "contains",
					"value":    "staging",
				}),
			),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod"),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-staging"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
	)

	ctx := context.Background()

	// 2 release targets should exist
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Both release targets should match the policy
	rtProd := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rtStaging := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	policiesProd, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtProd)
	if len(policiesProd) != 1 {
		t.Fatalf("expected policy to match prod release target, got %d policies", len(policiesProd))
	}

	policiesStaging, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, rtStaging)
	if len(policiesStaging) != 1 {
		t.Fatalf("expected policy to match staging release target, got %d policies", len(policiesStaging))
	}
}
