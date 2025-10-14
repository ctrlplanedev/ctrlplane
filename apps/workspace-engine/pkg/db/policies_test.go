package db

import (
	"fmt"
	"strings"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedPolicies(t *testing.T, actualPolicies []*oapi.Policy, expectedPolicies []*oapi.Policy) {
	t.Helper()
	if len(actualPolicies) != len(expectedPolicies) {
		t.Fatalf("expected %d policies, got %d", len(expectedPolicies), len(actualPolicies))
	}
	for _, expected := range expectedPolicies {
		var actual *oapi.Policy
		for _, ap := range actualPolicies {
			if ap.Id == expected.Id {
				actual = ap
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected policy with id %s not found", expected.Id)
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected policy id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Name != expected.Name {
			t.Fatalf("expected policy name %s, got %s", expected.Name, actual.Name)
		}
		if actual.WorkspaceId != expected.WorkspaceId {
			t.Fatalf("expected policy workspace_id %s, got %s", expected.WorkspaceId, actual.WorkspaceId)
		}
		compareStrPtr(t, actual.Description, expected.Description)
		if actual.CreatedAt == "" {
			t.Fatalf("expected policy created_at to be set")
		}

		// Validate selectors
		if len(actual.Selectors) != len(expected.Selectors) {
			t.Fatalf("expected %d selectors, got %d", len(expected.Selectors), len(actual.Selectors))
		}
		for i, expectedSelector := range expected.Selectors {
			var actualSelector *oapi.PolicyTargetSelector
			for _, as := range actual.Selectors {
				if as.Id == expectedSelector.Id {
					actualSelector = &as
					break
				}
			}
			if actualSelector == nil {
				t.Fatalf("expected selector with id %s not found", expectedSelector.Id)
			}
			if actualSelector.Id != expectedSelector.Id {
				t.Fatalf("selector %d: expected id %s, got %s", i, expectedSelector.Id, actualSelector.Id)
			}
			// Note: Selector fields (DeploymentSelector, EnvironmentSelector, ResourceSelector)
			// are complex JSON types. Empty selectors may be stored as NULL and returned as nil.
			// We only validate selector presence by ID and count, not the JSON content itself.
		}

		// Validate rules
		if len(actual.Rules) != len(expected.Rules) {
			t.Fatalf("expected %d rules, got %d", len(expected.Rules), len(actual.Rules))
		}
		for i, expectedRule := range expected.Rules {
			var actualRule *oapi.PolicyRule
			for _, ar := range actual.Rules {
				if ar.Id == expectedRule.Id {
					actualRule = &ar
					break
				}
			}
			if actualRule == nil {
				t.Fatalf("expected rule with id %s not found", expectedRule.Id)
			}
			if actualRule.PolicyId != expected.Id {
				t.Fatalf("rule %d: expected policy_id %s, got %s", i, expected.Id, actualRule.PolicyId)
			}
			if actualRule.AnyApproval != nil && expectedRule.AnyApproval != nil {
				if actualRule.AnyApproval.MinApprovals != expectedRule.AnyApproval.MinApprovals {
					t.Fatalf("rule %d: expected min_approvals %d, got %d", i, expectedRule.AnyApproval.MinApprovals, actualRule.AnyApproval.MinApprovals)
				}
			} else if (actualRule.AnyApproval == nil) != (expectedRule.AnyApproval == nil) {
				t.Fatalf("rule %d: any_approval nil mismatch", i)
			}
		}
	}
}

func TestDBPolicies_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	description := "test policy description"
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		Description: &description,
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules:       []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithDeploymentSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	deploymentSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                 uuid.New().String(),
				DeploymentSelector: deploymentSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithEnvironmentSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	environmentSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  uuid.New().String(),
				EnvironmentSelector: environmentSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	resourceSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:               uuid.New().String(),
				ResourceSelector: resourceSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithAllSelectors(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	deploymentSelector := &oapi.Selector{}
	environmentSelector := &oapi.Selector{}
	resourceSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  uuid.New().String(),
				DeploymentSelector:  deploymentSelector,
				EnvironmentSelector: environmentSelector,
				ResourceSelector:    resourceSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithMultipleSelectors(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	deploymentSelector := &oapi.Selector{}
	environmentSelector := &oapi.Selector{}
	resourceSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                 uuid.New().String(),
				DeploymentSelector: deploymentSelector,
			},
			{
				Id:                  uuid.New().String(),
				EnvironmentSelector: environmentSelector,
			},
			{
				Id:               uuid.New().String(),
				ResourceSelector: resourceSelector,
			},
			{
				Id:                  uuid.New().String(),
				DeploymentSelector:  deploymentSelector,
				EnvironmentSelector: environmentSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithAnyApprovalRule(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  policyID,
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_WithDifferentMinApprovals(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create policies with different minApprovals values
	policies := []*oapi.Policy{
		{
			Id:          uuid.New().String(),
			Name:        "policy-min-1",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors:   []oapi.PolicyTargetSelector{},
			Rules: []oapi.PolicyRule{
				{
					Id:        uuid.New().String(),
					PolicyId:  "",
					CreatedAt: time.Now().Format(time.RFC3339),
					AnyApproval: &oapi.AnyApprovalRule{
						MinApprovals: 1,
					},
				},
			},
		},
		{
			Id:          uuid.New().String(),
			Name:        "policy-min-3",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors:   []oapi.PolicyTargetSelector{},
			Rules: []oapi.PolicyRule{
				{
					Id:        uuid.New().String(),
					PolicyId:  "",
					CreatedAt: time.Now().Format(time.RFC3339),
					AnyApproval: &oapi.AnyApprovalRule{
						MinApprovals: 3,
					},
				},
			},
		},
		{
			Id:          uuid.New().String(),
			Name:        "policy-min-5",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors:   []oapi.PolicyTargetSelector{},
			Rules: []oapi.PolicyRule{
				{
					Id:        uuid.New().String(),
					PolicyId:  "",
					CreatedAt: time.Now().Format(time.RFC3339),
					AnyApproval: &oapi.AnyApprovalRule{
						MinApprovals: 5,
					},
				},
			},
		},
	}

	for _, policy := range policies {
		policy.Rules[0].PolicyId = policy.Id
		err = writePolicy(t.Context(), policy, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, policies)
}

func TestDBPolicies_WithSelectorsAndRules(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	deploymentSelector := &oapi.Selector{}
	environmentSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                  uuid.New().String(),
				DeploymentSelector:  deploymentSelector,
				EnvironmentSelector: environmentSelector,
			},
		},
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  policyID,
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedPolicies := []*oapi.Policy{policy}
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedPolicies(t, actualPolicies, expectedPolicies)
}

func TestDBPolicies_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules:       []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify policy exists
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedPolicies(t, actualPolicies, []*oapi.Policy{policy})

	// Delete policy
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deletePolicy(t.Context(), policyID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify policy is deleted
	actualPolicies, err = getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedPolicies(t, actualPolicies, []*oapi.Policy{})
}

func TestDBPolicies_UpdateSelectors(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	deploymentSelector := &oapi.Selector{}
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{
			{
				Id:                 uuid.New().String(),
				DeploymentSelector: deploymentSelector,
			},
		},
		Rules: []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update policy with different selectors
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	environmentSelector := &oapi.Selector{}
	resourceSelector := &oapi.Selector{}
	policy.Selectors = []oapi.PolicyTargetSelector{
		{
			Id:                  uuid.New().String(),
			EnvironmentSelector: environmentSelector,
		},
		{
			Id:               uuid.New().String(),
			ResourceSelector: resourceSelector,
		},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedPolicies(t, actualPolicies, []*oapi.Policy{policy})
}

func TestDBPolicies_UpdateRules(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policyID := uuid.New().String()
	policy := &oapi.Policy{
		Id:          policyID,
		Name:        fmt.Sprintf("test-policy-%s", policyID[:8]),
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  policyID,
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update policy with different min approvals
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policy.Rules[0].AnyApproval.MinApprovals = 5

	err = writePolicy(t.Context(), policy, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedPolicies(t, actualPolicies, []*oapi.Policy{policy})
}

func TestDBPolicies_NonexistentWorkspaceThrowsError(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	policy := &oapi.Policy{
		Id:          uuid.New().String(),
		Name:        "test-policy",
		WorkspaceId: uuid.New().String(), // Non-existent workspace
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules:       []oapi.PolicyRule{},
	}

	err = writePolicy(t.Context(), policy, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}
}

func TestDBPolicies_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)

	// Create policy in workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx1.Rollback(t.Context())

	policy1 := &oapi.Policy{
		Id:          uuid.New().String(),
		Name:        "workspace1-policy",
		WorkspaceId: workspaceID1,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  "",
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}
	policy1.Rules[0].PolicyId = policy1.Id

	err = writePolicy(t.Context(), policy1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create policy in workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx2.Rollback(t.Context())

	policy2 := &oapi.Policy{
		Id:          uuid.New().String(),
		Name:        "workspace2-policy",
		WorkspaceId: workspaceID2,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Selectors:   []oapi.PolicyTargetSelector{},
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  "",
				CreatedAt: time.Now().Format(time.RFC3339),
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}
	policy2.Rules[0].PolicyId = policy2.Id

	err = writePolicy(t.Context(), policy2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify workspace 1 only sees its own policy
	policies1, err := getPolicies(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(policies1) != 1 {
		t.Fatalf("expected 1 policy in workspace 1, got %d", len(policies1))
	}
	if policies1[0].Id != policy1.Id {
		t.Fatalf("expected policy %s in workspace 1, got %s", policy1.Id, policies1[0].Id)
	}

	// Verify workspace 2 only sees its own policy
	policies2, err := getPolicies(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(policies2) != 1 {
		t.Fatalf("expected 1 policy in workspace 2, got %d", len(policies2))
	}
	if policies2[0].Id != policy2.Id {
		t.Fatalf("expected policy %s in workspace 2, got %s", policy2.Id, policies2[0].Id)
	}
}

func TestDBPolicies_MultiplePolicies(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	deploymentSelector := &oapi.Selector{}
	environmentSelector := &oapi.Selector{}
	resourceSelector := &oapi.Selector{}

	// Create multiple policies with different configurations
	policies := []*oapi.Policy{
		{
			Id:          uuid.New().String(),
			Name:        "policy-with-deployment",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors: []oapi.PolicyTargetSelector{
				{
					Id:                 uuid.New().String(),
					DeploymentSelector: deploymentSelector,
				},
			},
			Rules: []oapi.PolicyRule{},
		},
		{
			Id:          uuid.New().String(),
			Name:        "policy-with-environment",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors: []oapi.PolicyTargetSelector{
				{
					Id:                  uuid.New().String(),
					EnvironmentSelector: environmentSelector,
				},
			},
			Rules: []oapi.PolicyRule{},
		},
		{
			Id:          uuid.New().String(),
			Name:        "policy-with-rule",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors:   []oapi.PolicyTargetSelector{},
			Rules: []oapi.PolicyRule{
				{
					Id:        uuid.New().String(),
					PolicyId:  "",
					CreatedAt: time.Now().Format(time.RFC3339),
					AnyApproval: &oapi.AnyApprovalRule{
						MinApprovals: 3,
					},
				},
			},
		},
		{
			Id:          uuid.New().String(),
			Name:        "policy-with-all",
			WorkspaceId: workspaceID,
			CreatedAt:   time.Now().Format(time.RFC3339),
			Selectors: []oapi.PolicyTargetSelector{
				{
					Id:                  uuid.New().String(),
					DeploymentSelector:  deploymentSelector,
					EnvironmentSelector: environmentSelector,
					ResourceSelector:    resourceSelector,
				},
			},
			Rules: []oapi.PolicyRule{
				{
					Id:        uuid.New().String(),
					PolicyId:  "",
					CreatedAt: time.Now().Format(time.RFC3339),
					AnyApproval: &oapi.AnyApprovalRule{
						MinApprovals: 2,
					},
				},
			},
		},
	}

	for _, policy := range policies {
		if len(policy.Rules) > 0 {
			policy.Rules[0].PolicyId = policy.Id
		}
		err = writePolicy(t.Context(), policy, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify all policies
	actualPolicies, err := getPolicies(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedPolicies(t, actualPolicies, policies)
}
