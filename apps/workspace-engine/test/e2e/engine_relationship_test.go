package e2e

import (
	"context"
	"testing"
	"workspace-engine/test/integration"
)

func TestEngine_RelationshipRuleCreation(t *testing.T) {
	relationshipRuleID := "rel-rule-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleDescription("Links VPCs to K8s clusters in the same region"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
	)

	// Verify the relationship rule was created
	rule, exists := engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if !exists {
		t.Fatalf("relationship rule not found")
	}

	if rule.Name != "vpc-to-cluster" {
		t.Fatalf("relationship rule name is %s, want vpc-to-cluster", rule.Name)
	}

	if rule.FromType != "resource" {
		t.Fatalf("relationship rule from type is %s, want resource", rule.FromType)
	}

	if rule.ToType != "resource" {
		t.Fatalf("relationship rule to type is %s, want resource", rule.ToType)
	}

	if rule.RelationshipType != "contains" {
		t.Fatalf("relationship type is %s, want contains", rule.RelationshipType)
	}

	pm, err := rule.Matcher.AsPropertiesMatcher()
	if err != nil {
		t.Fatalf("error getting property matchers: %v", err)
	}
	if len(pm.Properties) != 1 {
		t.Fatalf("property matchers count is %d, want 1", len(pm.Properties))
	}

	matcher := pm.Properties[0]
	if len(matcher.FromProperty) != 2 || matcher.FromProperty[0] != "metadata" || matcher.FromProperty[1] != "region" {
		t.Fatalf("property matcher from property is %v, want [metadata region]", matcher.FromProperty)
	}

	if len(matcher.ToProperty) != 2 || matcher.ToProperty[0] != "metadata" || matcher.ToProperty[1] != "region" {
		t.Fatalf("property matcher to property is %v, want [metadata region]", matcher.ToProperty)
	}

	if matcher.Operator != "equals" {
		t.Fatalf("property matcher operator is %v, want equals", matcher.Operator)
	}
}

func TestEngine_MultipleRelationshipRules(t *testing.T) {
	relationshipRuleID1 := "rel-rule-1"
	relationshipRuleID2 := "rel-rule-2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID1),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID2),
			integration.RelationshipRuleName("cluster-to-service"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
			integration.RelationshipRuleType("runs-on"),
		),
	)

	// Verify both relationship rules were created
	rule1, exists1 := engine.Workspace().RelationshipRules().Get(relationshipRuleID1)
	if !exists1 {
		t.Fatalf("relationship rule 1 not found")
	}

	rule2, exists2 := engine.Workspace().RelationshipRules().Get(relationshipRuleID2)
	if !exists2 {
		t.Fatalf("relationship rule 2 not found")
	}

	if rule1.Name != "vpc-to-cluster" {
		t.Fatalf("relationship rule 1 name is %s, want vpc-to-cluster", rule1.Name)
	}

	if rule2.Name != "cluster-to-service" {
		t.Fatalf("relationship rule 2 name is %s, want cluster-to-service", rule2.Name)
	}

	if rule1.RelationshipType != "contains" {
		t.Fatalf("relationship rule 1 type is %s, want contains", rule1.RelationshipType)
	}

	if rule2.RelationshipType != "runs-on" {
		t.Fatalf("relationship rule 2 type is %s, want runs-on", rule2.RelationshipType)
	}
}

func TestEngine_RelationshipRuleRemoval(t *testing.T) {
	relationshipRuleID1 := "rel-rule-1"
	relationshipRuleID2 := "rel-rule-2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID1),
			integration.RelationshipRuleName("rule-1"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID2),
			integration.RelationshipRuleName("rule-2"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
			integration.RelationshipRuleType("runs-on"),
		),
	)

	// Verify both rules exist
	_, exists := engine.Workspace().RelationshipRules().Get(relationshipRuleID1)
	if !exists {
		t.Fatalf("relationship rule 1 not found")
	}

	_, exists = engine.Workspace().RelationshipRules().Get(relationshipRuleID2)
	if !exists {
		t.Fatalf("relationship rule 2 not found")
	}

	// Remove rule 1
	ctx := context.Background()
	engine.Workspace().RelationshipRules().Remove(ctx, relationshipRuleID1)

	// Verify rule 1 is gone
	_, exists = engine.Workspace().RelationshipRules().Get(relationshipRuleID1)
	if exists {
		t.Fatalf("relationship rule 1 should be deleted")
	}

	// Verify rule 2 still exists
	rule2After, exists := engine.Workspace().RelationshipRules().Get(relationshipRuleID2)
	if !exists {
		t.Fatalf("relationship rule 2 should still exist")
	}
	if rule2After.Name != "rule-2" {
		t.Fatalf("relationship rule 2 name after deletion is %s, want rule-2", rule2After.Name)
	}
}

func TestEngine_RelationshipRuleRemovalWithResources(t *testing.T) {
	relationshipRuleID := "rel-rule-vpc-cluster"
	resourceVpcID := "vpc-1"
	resourceClusterID := "cluster-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID),
			integration.RelationshipRuleName("vpc-to-cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceVpcID),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceClusterID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
	)

	ctx := context.Background()

	// Verify the resources exist
	vpc, exists := engine.Workspace().Resources().Get(resourceVpcID)
	if !exists {
		t.Fatalf("vpc resource not found")
	}

	cluster, exists := engine.Workspace().Resources().Get(resourceClusterID)
	if !exists {
		t.Fatalf("cluster resource not found")
	}

	// Verify the relationship rule exists
	_, exists = engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if !exists {
		t.Fatalf("relationship rule not found")
	}

	// Remove the relationship rule
	engine.Workspace().RelationshipRules().Remove(ctx, relationshipRuleID)

	// Verify the rule is gone
	_, exists = engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if exists {
		t.Fatalf("relationship rule should be deleted")
	}

	// Verify resources still exist (deleting relationship rule shouldn't delete resources)
	vpcAfter, exists := engine.Workspace().Resources().Get(resourceVpcID)
	if !exists {
		t.Fatalf("vpc resource should still exist")
	}
	if vpcAfter.Id != vpc.Id {
		t.Fatalf("vpc resource changed after rule deletion")
	}

	clusterAfter, exists := engine.Workspace().Resources().Get(resourceClusterID)
	if !exists {
		t.Fatalf("cluster resource should still exist")
	}
	if clusterAfter.Id != cluster.Id {
		t.Fatalf("cluster resource changed after rule deletion")
	}
}

func TestEngine_RelationshipRuleRemovalMultiple(t *testing.T) {
	rule1ID := "rel-rule-1"
	rule2ID := "rel-rule-2"
	rule3ID := "rel-rule-3"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule1ID),
			integration.RelationshipRuleName("rule-1"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule2ID),
			integration.RelationshipRuleName("rule-2"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
			integration.RelationshipRuleType("runs-on"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule3ID),
			integration.RelationshipRuleName("rule-3"),
			integration.RelationshipRuleFromType("deployment"),
			integration.RelationshipRuleToType("environment"),
			integration.RelationshipRuleType("deploys-to"),
		),
	)

	ctx := context.Background()

	// Verify all rules exist
	initialRules := engine.Workspace().RelationshipRules().Items()
	if len(initialRules) != 3 {
		t.Fatalf("expected 3 relationship rules, got %d", len(initialRules))
	}

	// Remove rules 1 and 2
	engine.Workspace().RelationshipRules().Remove(ctx, rule1ID)
	engine.Workspace().RelationshipRules().Remove(ctx, rule2ID)

	// Verify only rule 3 remains
	remainingRules := engine.Workspace().RelationshipRules().Items()
	if len(remainingRules) != 1 {
		t.Fatalf("expected 1 remaining rule, got %d", len(remainingRules))
	}

	rule3, exists := engine.Workspace().RelationshipRules().Get(rule3ID)
	if !exists {
		t.Fatalf("rule 3 should still exist")
	}
	if rule3.Name != "rule-3" {
		t.Fatalf("remaining rule name is %s, want rule-3", rule3.Name)
	}
}

func TestEngine_RelationshipRuleRemovalAndRecreation(t *testing.T) {
	relationshipRuleID := "rel-rule-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relationshipRuleID),
			integration.RelationshipRuleName("original-rule"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
		),
	)

	ctx := context.Background()

	// Verify rule exists
	originalRule, exists := engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if !exists {
		t.Fatalf("original relationship rule not found")
	}
	if originalRule.Name != "original-rule" {
		t.Fatalf("original rule name is %s, want original-rule", originalRule.Name)
	}

	// Remove the rule
	engine.Workspace().RelationshipRules().Remove(ctx, relationshipRuleID)

	// Verify rule is gone
	_, exists = engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if exists {
		t.Fatalf("relationship rule should be deleted")
	}

	// Recreate rule with same ID but different properties
	newRule := originalRule
	newRule.Name = "recreated-rule"
	newRule.RelationshipType = "depends-on"

	err := engine.Workspace().RelationshipRules().Upsert(ctx, newRule)
	if err != nil {
		t.Fatalf("failed to recreate rule: %v", err)
	}

	// Verify new rule exists with updated properties
	recreatedRule, exists := engine.Workspace().RelationshipRules().Get(relationshipRuleID)
	if !exists {
		t.Fatalf("recreated relationship rule not found")
	}
	if recreatedRule.Name != "recreated-rule" {
		t.Fatalf("recreated rule name is %s, want recreated-rule", recreatedRule.Name)
	}
	if recreatedRule.RelationshipType != "depends-on" {
		t.Fatalf("recreated rule type is %s, want depends-on", recreatedRule.RelationshipType)
	}
}

func TestEngine_RelationshipRuleRemovalWithCrossEntityTypes(t *testing.T) {
	rule1ID := "resource-to-deployment"
	rule2ID := "deployment-to-environment"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentName("test-deployment"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("test-environment"),
			),
		),
		integration.WithResource(
			integration.ResourceName("test-resource"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule1ID),
			integration.RelationshipRuleName("resource-to-deployment"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("deployment"),
			integration.RelationshipRuleType("deployed-by"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(rule2ID),
			integration.RelationshipRuleName("deployment-to-environment"),
			integration.RelationshipRuleFromType("deployment"),
			integration.RelationshipRuleToType("environment"),
			integration.RelationshipRuleType("deploys-to"),
		),
	)

	ctx := context.Background()

	// Verify all entities exist
	resources := engine.Workspace().Resources().Items()
	if len(resources) == 0 {
		t.Fatalf("expected at least 1 resource")
	}

	deployments := engine.Workspace().Deployments().Items()
	if len(deployments) == 0 {
		t.Fatalf("expected at least 1 deployment")
	}

	environments := engine.Workspace().Environments().Items()
	if len(environments) == 0 {
		t.Fatalf("expected at least 1 environment")
	}

	// Remove first relationship rule
	engine.Workspace().RelationshipRules().Remove(ctx, rule1ID)

	// Verify first rule is gone
	_, exists := engine.Workspace().RelationshipRules().Get(rule1ID)
	if exists {
		t.Fatalf("rule 1 should be deleted")
	}

	// Verify second rule still exists
	_, exists = engine.Workspace().RelationshipRules().Get(rule2ID)
	if !exists {
		t.Fatalf("rule 2 should still exist")
	}

	// Verify all entities still exist
	resourcesAfter := engine.Workspace().Resources().Items()
	if len(resourcesAfter) != len(resources) {
		t.Fatalf("resources count changed after rule deletion")
	}

	deploymentsAfter := engine.Workspace().Deployments().Items()
	if len(deploymentsAfter) != len(deployments) {
		t.Fatalf("deployments count changed after rule deletion")
	}

	environmentsAfter := engine.Workspace().Environments().Items()
	if len(environmentsAfter) != len(environments) {
		t.Fatalf("environments count changed after rule deletion")
	}
}
