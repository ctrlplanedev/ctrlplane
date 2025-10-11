package e2e

import (
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
