package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
)

// TestEngine_DeploymentSelectorAndCondition tests AND conditions in deployment selectors.
// KNOWN ISSUE: AND conditions don't work correctly - they match deployments that only
// satisfy one condition instead of requiring all conditions to be true.
func TestEngine_DeploymentSelectorAndCondition(t *testing.T) {
	d1ID := "d1-1"
	d2ID := "d2-1"
	d3ID := "d3-1"
	r1ID := "r1-1"
	r2ID := "r2-1"
	r3ID := "r3-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod-web"),
				integration.DeploymentJsonResourceSelector(map[string]any{
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
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-prod-api"),
				integration.DeploymentJsonResourceSelector(map[string]any{
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
			),
			integration.WithDeployment(
				integration.DeploymentID(d3ID),
				integration.DeploymentName("deployment-dev-web"),
				integration.DeploymentJsonResourceSelector(map[string]any{
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
			integration.ResourceID(r1ID),
			integration.ResourceName("resource-prod-web"),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("resource-prod-api"),
		),
		integration.WithResource(
			integration.ResourceID(r3ID),
			integration.ResourceName("resource-dev-web"),
		),
	)

	ctx := context.Background()

	// Expected behavior: Only d1 should match r1 (both contain "prod" AND "web")
	// BUG: Currently d1 matches all resources because AND condition doesn't work

	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)

	// Count release targets for each deployment
	d1Count := 0
	d2Count := 0
	d3Count := 0
	for _, rt := range releaseTargets {
		switch rt.DeploymentId {
		case d1ID:
			d1Count++
		case d2ID:
			d2Count++
		case d3ID:
			d3Count++
		}
	}

	// Expected: d1 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if d1Count != 1 {
		t.Errorf("d1 (prod-web) should match only 1 resource (prod-web), got %d", d1Count)
	}

	// Expected: d2 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if d2Count != 1 {
		t.Errorf("d2 (prod-api) should match only 1 resource (prod-web), got %d", d2Count)
	}

	// Expected: d3 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if d3Count != 1 {
		t.Errorf("d3 (dev-web) should match only 1 resource (prod-web), got %d", d3Count)
	}
}

// TestEngine_EnvironmentSelectorAndCondition tests AND conditions in environment selectors.
// KNOWN ISSUE: AND conditions don't work correctly - they match environments that only
// satisfy one condition instead of requiring all conditions to be true.
func TestEngine_EnvironmentSelectorAndCondition(t *testing.T) {
	e1ID := "e1-1"
	e2ID := "e2-1"
	e3ID := "e3-1"
	r1ID := "r1-1"
	r2ID := "r2-1"
	r3ID := "r3-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentName("env-prod-us-east"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
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
							"value":    "us-east",
						},
					},
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2ID),
				integration.EnvironmentName("env-prod-us-west"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
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
							"value":    "us-east",
						},
					},
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e3ID),
				integration.EnvironmentName("env-dev-us-east"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
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
							"value":    "us-east",
						},
					},
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("resource-prod-us-east"),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("resource-prod-us-west"),
		),
		integration.WithResource(
			integration.ResourceID(r3ID),
			integration.ResourceName("resource-dev-us-east"),
		),
	)

	ctx := context.Background()

	// Expected behavior: Only e1 should match r1 (both contain "prod" AND "us-east")
	// BUG: Currently e1 matches all resources because AND condition doesn't work

	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)

	// Count release targets for each environment
	e1Count := 0
	e2Count := 0
	e3Count := 0
	for _, rt := range releaseTargets {
		switch rt.EnvironmentId {
		case e1ID:
			e1Count++
		case e2ID:
			e2Count++
		case e3ID:
			e3Count++
		}
	}

	// Expected: e1 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if e1Count != 1 {
		t.Errorf("e1 (prod-us-east) should match only 1 resource (prod-us-east), got %d", e1Count)
	}

	// Expected: e2 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if e2Count != 1 {
		t.Errorf("e2 (prod-us-west) should match only 1 resource (prod-us-east), got %d", e2Count)
	}

	// Expected: e3 should match only r1 (1 release target)
	// BUG: Currently matches all 3 resources
	if e3Count != 1 {
		t.Errorf("e3 (dev-us-east) should match only 1 resource (prod-us-east), got %d", e3Count)
	}
}

// TestEngine_PolicyDeploymentSelectorAndCondition tests AND conditions in policy deployment selectors.
// KNOWN ISSUE: AND conditions don't work correctly - they match deployments that only
// satisfy one condition instead of requiring all conditions to be true.
func TestEngine_PolicyDeploymentSelectorAndCondition(t *testing.T) {
	d1ID := "d1-1"
	d2ID := "d2-1"
	d3ID := "d3-1"
	e1ID := "e1-1"
	r1ID := "r1-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
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
			integration.PolicyName("policy-prod-web-only"),
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
			),
		),
	)

	ctx := context.Background()

	// 3 release targets should exist (one for each deployment)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Test each release target
	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rt3 := &oapi.ReleaseTarget{
		DeploymentId:  d3ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	policies1 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt1)
	policies2 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt2)
	policies3 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt3)

	// Expected: Only d1 (prod-web) should match the policy
	if len(policies1) != 1 {
		t.Errorf("d1 (deployment-prod-web) should match policy, got %d policies", len(policies1))
	}

	// Expected: d2 (prod-api) should NOT match - it has "prod" but not "web"
	// BUG: Currently matches because AND condition doesn't work
	if len(policies2) != 0 {
		t.Errorf("d2 (deployment-prod-api) should NOT match policy, got %d policies", len(policies2))
	}

	// Expected: d3 (dev-web) should NOT match - it has "web" but not "prod"
	// BUG: Currently matches because AND condition doesn't work
	if len(policies3) != 0 {
		t.Errorf("d3 (deployment-dev-web) should NOT match policy, got %d policies", len(policies3))
	}
}

// TestEngine_PolicyEnvironmentSelectorAndCondition tests AND conditions in policy environment selectors.
// KNOWN ISSUE: AND conditions don't work correctly - they match environments that only
// satisfy one condition instead of requiring all conditions to be true.
func TestEngine_PolicyEnvironmentSelectorAndCondition(t *testing.T) {
	d1ID := "d1-1"
	e1ID := "e1-1"
	e2ID := "e2-1"
	e3ID := "e3-1"
	r1ID := "r1-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentName("env-prod-us-east"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2ID),
				integration.EnvironmentName("env-prod-us-west"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e3ID),
				integration.EnvironmentName("env-dev-us-east"),
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
			integration.PolicyName("policy-prod-east-only"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonEnvironmentSelector(map[string]any{
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
							"value":    "us-east",
						},
					},
				}),
			),
		),
	)

	ctx := context.Background()

	// 3 release targets should exist (one for each environment)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Test each release target
	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}

	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e2ID,
		ResourceId:    r1ID,
	}

	rt3 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e3ID,
		ResourceId:    r1ID,
	}

	policies1 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt1)
	policies2 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt2)
	policies3 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt3)

	// Expected: Only e1 (prod-us-east) should match the policy
	if len(policies1) != 1 {
		t.Errorf("e1 (env-prod-us-east) should match policy, got %d policies", len(policies1))
	}

	// Expected: e2 (prod-us-west) should NOT match - it has "prod" but not "us-east"
	// BUG: Currently matches because AND condition doesn't work
	if len(policies2) != 0 {
		t.Errorf("e2 (env-prod-us-west) should NOT match policy, got %d policies", len(policies2))
	}

	// Expected: e3 (dev-us-east) should NOT match - it has "us-east" but not "prod"
	// BUG: Currently matches because AND condition doesn't work
	if len(policies3) != 0 {
		t.Errorf("e3 (env-dev-us-east) should NOT match policy, got %d policies", len(policies3))
	}
}

// TestEngine_PolicyComplexAndConditions tests complex AND conditions across
// deployments, environments, and resources in policy selectors.
func TestEngine_PolicyComplexAndConditions(t *testing.T) {
	d1ID := "d1-1"
	d2ID := "d2-1"
	d3ID := "d3-1"
	e1ID := "e1-1"
	e2ID := "e2-1"
	r1ID := "r1-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e2ID),
				integration.EnvironmentName("env-us-west"),
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

	// Test: d1 (prod web) + e1 (us-east) + r1 should match (selector1)
	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}
	policies1 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt1)
	if len(policies1) != 1 {
		t.Errorf("expected policy to match d1+e1+r1, got %d policies", len(policies1))
	}

	// Test: d3 (dev web) + e2 (us-west) + r1 should match (selector2)
	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  d3ID,
		EnvironmentId: e2ID,
		ResourceId:    r1ID,
	}
	policies2 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt2)
	if len(policies2) != 1 {
		t.Errorf("expected policy to match d3+e2+r1, got %d policies", len(policies2))
	}

	// Test: d2 (prod api) + e1 (us-east) + r1 should NOT match (wrong app type)
	// BUG: Currently matches because AND doesn't filter out "api"
	rt3 := &oapi.ReleaseTarget{
		DeploymentId:  d2ID,
		EnvironmentId: e1ID,
		ResourceId:    r1ID,
	}
	policies3 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt3)
	if len(policies3) != 0 {
		t.Errorf("expected policy NOT to match d2+e1+r1, got %d policies", len(policies3))
	}

	// Test: d1 (prod web) + e2 (us-west) + r1 should NOT match (wrong region for selector1)
	rt4 := &oapi.ReleaseTarget{
		DeploymentId:  d1ID,
		EnvironmentId: e2ID,
		ResourceId:    r1ID,
	}
	policies4 := engine.Workspace().Policies().GetPoliciesForReleaseTarget(ctx, rt4)
	if len(policies4) != 0 {
		t.Errorf("expected policy NOT to match d1+e2+r1, got %d policies", len(policies4))
	}
}
