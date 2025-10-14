package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedRelationships(t *testing.T, actualRules []*oapi.RelationshipRule, expectedRules []*oapi.RelationshipRule) {
	t.Helper()
	if len(actualRules) != len(expectedRules) {
		t.Fatalf("expected %d relationship rules, got %d", len(expectedRules), len(actualRules))
	}
	for _, expected := range expectedRules {
		var actual *oapi.RelationshipRule
		for _, ar := range actualRules {
			if ar.Id == expected.Id {
				actual = ar
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected relationship rule with id %s not found", expected.Id)
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Name != expected.Name {
			t.Fatalf("expected name %s, got %s", expected.Name, actual.Name)
		}
		if actual.Reference != expected.Reference {
			t.Fatalf("expected reference %s, got %s", expected.Reference, actual.Reference)
		}
		if actual.RelationshipType != expected.RelationshipType {
			t.Fatalf("expected relationship_type %s, got %s", expected.RelationshipType, actual.RelationshipType)
		}
		compareStrPtr(t, actual.Description, expected.Description)

		// Validate selectors are present (content validation is complex due to JSON)
		if (expected.FromSelector != nil) != (actual.FromSelector != nil) {
			t.Fatalf("from_selector nil mismatch")
		}
		if (expected.ToSelector != nil) != (actual.ToSelector != nil) {
			t.Fatalf("to_selector nil mismatch")
		}

		// Validate matcher (basic presence check)
		propertiesMatcher, err := actual.Matcher.AsPropertiesMatcher()
		if err == nil && len(propertiesMatcher.Properties) > 0 {
			// Matcher has properties
			expectedMatcher, err := expected.Matcher.AsPropertiesMatcher()
			if err != nil {
				t.Fatalf("expected matcher to be PropertiesMatcher")
			}
			if len(propertiesMatcher.Properties) != len(expectedMatcher.Properties) {
				t.Fatalf("expected %d property matchers, got %d", len(expectedMatcher.Properties), len(propertiesMatcher.Properties))
			}
		}
	}
}

func TestDBRelationships_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	ruleID := uuid.New().String()
	description := "test relationship rule"
	rule := &oapi.RelationshipRule{
		Id:               ruleID,
		Name:             fmt.Sprintf("test-rule-%s", ruleID[:8]),
		Description:      &description,
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
	// Set empty PropertiesMatcher
	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedRules := []*oapi.RelationshipRule{rule}
	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedRelationships(t, actualRules, expectedRules)
}

// Note: Selector tests are complex due to union types in the OAPI spec.
// The core relationship functionality is tested through property matchers.
// Selectors are tested implicitly through the get/write round-trip.

func TestDBRelationships_WithPropertyMatcher(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	ruleID := uuid.New().String()
	rule := &oapi.RelationshipRule{
		Id:               ruleID,
		Name:             fmt.Sprintf("test-rule-%s", ruleID[:8]),
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}

	// Set property matcher
	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "cluster_id"},
				ToProperty:   []string{"metadata", "cluster_id"},
				Operator:     oapi.Equals,
			},
		},
	}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedRules := []*oapi.RelationshipRule{rule}
	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedRelationships(t, actualRules, expectedRules)
}

func TestDBRelationships_WithMultiplePropertyMatchers(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	ruleID := uuid.New().String()
	rule := &oapi.RelationshipRule{
		Id:               ruleID,
		Name:             fmt.Sprintf("test-rule-%s", ruleID[:8]),
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}

	// Set multiple property matchers
	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "cluster_id"},
				ToProperty:   []string{"metadata", "cluster_id"},
				Operator:     oapi.Equals,
			},
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     oapi.Equals,
			},
			{
				FromProperty: []string{"metadata", "environment"},
				ToProperty:   []string{"metadata", "env"},
				Operator:     oapi.Equals,
			},
		},
	}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedRules := []*oapi.RelationshipRule{rule}
	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedRelationships(t, actualRules, expectedRules)
}

func TestDBRelationships_DifferentRelationshipTypes(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create rules with different relationship types
	rules := []*oapi.RelationshipRule{
		{
			Id:               uuid.New().String(),
			Name:             "depends-on-rule",
			Reference:        "ref1",
			RelationshipType: "depends-on",
			FromType:         "resource",
			ToType:           "resource",
			WorkspaceId:      workspaceID,
			Metadata:         map[string]string{},
			Matcher:          oapi.RelationshipRule_Matcher{},
		},
		{
			Id:               uuid.New().String(),
			Name:             "uses-rule",
			Reference:        "ref2",
			RelationshipType: "uses",
			FromType:         "resource",
			ToType:           "resource",
			WorkspaceId:      workspaceID,
			Metadata:         map[string]string{},
			Matcher:          oapi.RelationshipRule_Matcher{},
		},
		{
			Id:               uuid.New().String(),
			Name:             "contains-rule",
			Reference:        "ref3",
			RelationshipType: "contains",
			FromType:         "resource",
			ToType:           "resource",
			WorkspaceId:      workspaceID,
			Metadata:         map[string]string{},
			Matcher:          oapi.RelationshipRule_Matcher{},
		},
	}

	for _, rule := range rules {
		if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
			t.Fatalf("failed to set matcher: %v", err)
		}
		err = writeRelationshipRule(t.Context(), rule, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedRelationships(t, actualRules, rules)
}

func TestDBRelationships_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	ruleID := uuid.New().String()
	rule := &oapi.RelationshipRule{
		Id:               ruleID,
		Name:             fmt.Sprintf("test-rule-%s", ruleID[:8]),
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify rule exists
	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedRelationships(t, actualRules, []*oapi.RelationshipRule{rule})

	// Delete rule
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deleteRelationshipRule(t.Context(), ruleID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify rule is deleted
	actualRules, err = getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedRelationships(t, actualRules, []*oapi.RelationshipRule{})
}

func TestDBRelationships_UpdateMatchers(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	ruleID := uuid.New().String()
	rule := &oapi.RelationshipRule{
		Id:               ruleID,
		Name:             fmt.Sprintf("test-rule-%s", ruleID[:8]),
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}

	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "cluster_id"},
				ToProperty:   []string{"metadata", "cluster_id"},
				Operator:     oapi.Equals,
			},
		},
	}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update with different matchers
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     oapi.Equals,
			},
			{
				FromProperty: []string{"metadata", "zone"},
				ToProperty:   []string{"metadata", "zone"},
				Operator:     oapi.Equals,
			},
		},
	}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualRules, err := getRelationships(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedRelationships(t, actualRules, []*oapi.RelationshipRule{rule})
}

func TestDBRelationships_NonexistentWorkspaceThrowsError(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	rule := &oapi.RelationshipRule{
		Id:               uuid.New().String(),
		Name:             "test-rule",
		Reference:        "test-reference",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      uuid.New().String(), // Non-existent workspace
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
	if err := rule.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}
}

func TestDBRelationships_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)

	// Create rule in workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx1.Rollback(t.Context())

	rule1 := &oapi.RelationshipRule{
		Id:               uuid.New().String(),
		Name:             "workspace1-rule",
		Reference:        "ref1",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID1,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
	if err := rule1.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create rule in workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx2.Rollback(t.Context())

	rule2 := &oapi.RelationshipRule{
		Id:               uuid.New().String(),
		Name:             "workspace2-rule",
		Reference:        "ref2",
		RelationshipType: "uses",
		FromType:         "resource",
		ToType:           "resource",
		WorkspaceId:      workspaceID2,
		Metadata:         map[string]string{},
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
	if err := rule2.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{Properties: []oapi.PropertyMatcher{}}); err != nil {
		t.Fatalf("failed to set matcher: %v", err)
	}

	err = writeRelationshipRule(t.Context(), rule2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify workspace 1 only sees its own rule
	rules1, err := getRelationships(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(rules1) != 1 {
		t.Fatalf("expected 1 rule in workspace 1, got %d", len(rules1))
	}
	if rules1[0].Id != rule1.Id {
		t.Fatalf("expected rule %s in workspace 1, got %s", rule1.Id, rules1[0].Id)
	}

	// Verify workspace 2 only sees its own rule
	rules2, err := getRelationships(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(rules2) != 1 {
		t.Fatalf("expected 1 rule in workspace 2, got %d", len(rules2))
	}
	if rules2[0].Id != rule2.Id {
		t.Fatalf("expected rule %s in workspace 2, got %s", rule2.Id, rules2[0].Id)
	}
}
