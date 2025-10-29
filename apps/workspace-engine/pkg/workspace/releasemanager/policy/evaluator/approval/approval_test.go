package approval

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"
)

// setupStore creates a test store with approval records and a test environment.
func setupStore(versionId string, environmentId string, approvers []string) *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)

	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(context.Background(), env)

	for _, userId := range approvers {
		record := &oapi.UserApprovalRecord{
			VersionId:     versionId,
			EnvironmentId: environmentId,
			UserId:        userId,
			Status:        oapi.ApprovalStatusApproved,
		}
		st.UserApprovalRecords.Upsert(context.Background(), record)
	}

	return st
}

func TestAnyApprovalEvaluator_EnoughApprovals(t *testing.T) {
	// Setup: 3 approvers, need 2
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2", "user-3"})

	rule := &oapi.AnyApprovalRule{MinApprovals: 2}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed, got denied: %s", result.Message)
	}

	if result.Details["min_approvals"] != 2 {
		t.Errorf("expected min_approvals=2, got %v", result.Details["min_approvals"])
	}

	approvers, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Fatal("expected approvers to be []string")
	}

	if len(approvers) != 3 {
		t.Errorf("expected 3 approvers, got %d", len(approvers))
	}
}

func TestAnyApprovalEvaluator_NotEnoughApprovals(t *testing.T) {
	// Setup: 1 approver, need 3
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1"})

	rule := &oapi.AnyApprovalRule{MinApprovals: 3}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied, got allowed: %s", result.Message)
	}

	if result.Details["min_approvals"] != 3 {
		t.Errorf("expected min_approvals=3, got %v", result.Details["min_approvals"])
	}

	approvers, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Fatal("expected approvers to be []string")
	}

	if len(approvers) != 1 {
		t.Errorf("expected 1 approver, got %d", len(approvers))
	}
}

func TestAnyApprovalEvaluator_ExactlyMinApprovals(t *testing.T) {
	// Setup: 2 approvers, need 2 (exact match)
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2"})

	rule := &oapi.AnyApprovalRule{MinApprovals: 2}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when approvals exactly meet minimum, got denied: %s", result.Message)
	}

	approvers, ok := result.Details["approvers"].([]string)
	if !ok || len(approvers) != 2 {
		t.Errorf("expected 2 approvers, got %d", len(approvers))
	}
}

func TestAnyApprovalEvaluator_NoApprovalsRequired(t *testing.T) {
	// Setup: 0 approvals required (rule disabled)
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{})

	rule := &oapi.AnyApprovalRule{MinApprovals: 0}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when no approvals required, got denied: %s", result.Message)
	}

	if result.Message != "No approvals required" {
		t.Errorf("expected reason 'No approvals required', got '%s'", result.Message)
	}
}

func TestAnyApprovalEvaluator_NoApprovalsGiven(t *testing.T) {
	// Setup: 0 approvers, need 1
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{})

	rule := &oapi.AnyApprovalRule{MinApprovals: 1}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when no approvals given, got allowed: %s", result.Message)
	}

	approvers, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Fatal("expected approvers to be []string")
	}

	if len(approvers) != 0 {
		t.Errorf("expected 0 approvers, got %d", len(approvers))
	}
}

func TestAnyApprovalEvaluator_MultipleVersionsIsolated(t *testing.T) {
	// Setup: Different approval counts for different versions
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)
	ctx := context.Background()

	environmentId := "env-1"
	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	// Version 1: 2 approvals
	for _, userId := range []string{"user-1", "user-2"} {
		st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
			VersionId:     "version-1",
			EnvironmentId: environmentId,
			UserId:        userId,
			Status:        oapi.ApprovalStatusApproved,
		})
	}

	// Version 2: 1 approval
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     "version-2",
		EnvironmentId: environmentId,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
	})

	rule := &oapi.AnyApprovalRule{MinApprovals: 2}
	evaluator := NewAnyApprovalEvaluator(st, rule)
	environment, _ := st.Environments.Get(environmentId)

	// Test version-1 (2 approvals, should pass)
	result1, err := evaluator.Evaluate(ctx, environment, &oapi.DeploymentVersion{Id: "version-1"})
	if err != nil {
		t.Fatalf("unexpected error for version-1: %v", err)
	}
	if !result1.Allowed {
		t.Errorf("expected version-1 allowed (has 2 approvals), got denied: %s", result1.Message)
	}

	// Test version-2 (1 approval, should fail)
	result2, err := evaluator.Evaluate(ctx, environment, &oapi.DeploymentVersion{Id: "version-2"})
	if err != nil {
		t.Fatalf("unexpected error for version-2: %v", err)
	}
	if result2.Allowed {
		t.Errorf("expected version-2 denied (has 1 approval), got allowed: %s", result2.Message)
	}

	// Verify approvers are version-specific
	approvers1 := result1.Details["approvers"].([]string)
	if len(approvers1) != 2 {
		t.Errorf("expected 2 approvers for version-1, got %d", len(approvers1))
	}

	approvers2 := result2.Details["approvers"].([]string)
	if len(approvers2) != 1 {
		t.Errorf("expected 1 approver for version-2, got %d", len(approvers2))
	}
}

func TestAnyApprovalEvaluator_EmptyVersionId(t *testing.T) {
	// Setup: Version with empty ID
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)
	ctx := context.Background()

	environmentId := "env-1"
	// Create test environment
	env := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, env)

	rule := &oapi.AnyApprovalRule{MinApprovals: 1}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: ""} // Empty ID
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(ctx, environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for empty version ID, got allowed: %s", result.Message)
	}

	if result.Message != "Version ID is required" {
		t.Errorf("expected 'Version ID is required', got '%s'", result.Message)
	}
}

func TestAnyApprovalEvaluator_ResultStructure(t *testing.T) {
	// Verify result has all expected fields and proper types
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1"})

	rule := &oapi.AnyApprovalRule{MinApprovals: 1}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Details == nil {
		t.Fatal("expected Details to be initialized")
	}

	if _, ok := result.Details["min_approvals"]; !ok {
		t.Error("expected Details to contain 'min_approvals'")
	}

	if _, ok := result.Details["approvers"]; !ok {
		t.Error("expected Details to contain 'approvers'")
	}

	if result.Message == "" {
		t.Error("expected Message to be set")
	}

	// Verify approvers is correct type
	approvers, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Error("expected approvers to be []string")
	}

	if len(approvers) != 1 {
		t.Errorf("expected 1 approver, got %d", len(approvers))
	}
}

func TestAnyApprovalEvaluator_ExceedsMinimum(t *testing.T) {
	// Setup: More approvals than required
	versionId := "version-1"
	environmentId := "env-1"
	st := setupStore(versionId, environmentId, []string{"user-1", "user-2", "user-3", "user-4", "user-5"})

	rule := &oapi.AnyApprovalRule{MinApprovals: 2}
	evaluator := NewAnyApprovalEvaluator(st, rule)

	version := &oapi.DeploymentVersion{Id: versionId}
	environment, _ := st.Environments.Get(environmentId)

	// Act
	result, err := evaluator.Evaluate(context.Background(), environment, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when approvals exceed minimum (5 > 2), got denied: %s", result.Message)
	}

	approvers := result.Details["approvers"].([]string)
	if len(approvers) != 5 {
		t.Errorf("expected 5 approvers, got %d", len(approvers))
	}
}
