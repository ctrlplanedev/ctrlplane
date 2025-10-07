package approval

import (
	"context"
	"testing"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store"
)

// Helper function to create a mock store with predefined approvers
func createMockStore(versionId string, approvers []string) *store.Store {
	mockStore := store.New()
	
	// Add approval records for each approver
	for _, userId := range approvers {
		record := &pb.UserApprovalRecord{
			VersionId: versionId,
			UserId:    userId,
			Status:    pb.ApprovalStatus_APPROVAL_STATUS_APPROVED,
		}
		mockStore.UserApprovalRecords.Upsert(context.Background(), record)
	}
	
	return mockStore
}

func TestAnyApprovalEvaluator_Evaluate_EnoughApprovals(t *testing.T) {
	versionId := "version-1"
	approvers := []string{"user-1", "user-2", "user-3"}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 2,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	if !result.Allowed {
		t.Error("Expected result to be allowed")
	}
	
	if result.Reason != "All approvals met" {
		t.Errorf("Expected reason 'All approvals met', got '%s'", result.Reason)
	}
	
	if result.Details["min_approvals"] != 2 {
		t.Errorf("Expected min_approvals to be 2, got %v", result.Details["min_approvals"])
	}
	
	approversDetail, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Error("Expected approvers detail to be []string")
	}
	
	if len(approversDetail) != 3 {
		t.Errorf("Expected 3 approvers, got %d", len(approversDetail))
	}
}

func TestAnyApprovalEvaluator_Evaluate_NotEnoughApprovals(t *testing.T) {
	versionId := "version-1"
	approvers := []string{"user-1"}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 3,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	if result.Allowed {
		t.Error("Expected result to be denied")
	}
	
	if result.Reason != "Not enough approvals" {
		t.Errorf("Expected reason 'Not enough approvals', got '%s'", result.Reason)
	}
	
	if result.Details["min_approvals"] != 3 {
		t.Errorf("Expected min_approvals to be 3, got %v", result.Details["min_approvals"])
	}
	
	approversDetail, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Error("Expected approvers detail to be []string")
	}
	
	if len(approversDetail) != 1 {
		t.Errorf("Expected 1 approver, got %d", len(approversDetail))
	}
}

func TestAnyApprovalEvaluator_Evaluate_ExactlyMinApprovals(t *testing.T) {
	versionId := "version-1"
	approvers := []string{"user-1", "user-2"}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 2,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	if !result.Allowed {
		t.Error("Expected result to be allowed when approvals equal min_approvals")
	}
	
	if result.Reason != "All approvals met" {
		t.Errorf("Expected reason 'All approvals met', got '%s'", result.Reason)
	}
}

func TestAnyApprovalEvaluator_Evaluate_NoApprovalsRequired(t *testing.T) {
	versionId := "version-1"
	approvers := []string{}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 0,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	if !result.Allowed {
		t.Error("Expected result to be allowed when no approvals are required")
	}
	
	if result.Reason != "All approvals met" {
		t.Errorf("Expected reason 'All approvals met', got '%s'", result.Reason)
	}
}

func TestAnyApprovalEvaluator_Evaluate_NoApprovalsGiven(t *testing.T) {
	versionId := "version-1"
	approvers := []string{}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 1,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	if result.Allowed {
		t.Error("Expected result to be denied when no approvals are given")
	}
	
	if result.Reason != "Not enough approvals" {
		t.Errorf("Expected reason 'Not enough approvals', got '%s'", result.Reason)
	}
	
	approversDetail, ok := result.Details["approvers"].([]string)
	if !ok {
		t.Error("Expected approvers detail to be []string")
	}
	
	if len(approversDetail) != 0 {
		t.Errorf("Expected 0 approvers, got %d", len(approversDetail))
	}
}

func TestAnyApprovalEvaluator_Evaluate_MultipleVersions(t *testing.T) {
	// Test that approvals for different versions don't interfere
	version1Id := "version-1"
	version2Id := "version-2"
	
	mockStore := store.New()
	
	// Add approvals for version-1
	for _, userId := range []string{"user-1", "user-2"} {
		record := &pb.UserApprovalRecord{
			VersionId: version1Id,
			UserId:    userId,
			Status:    pb.ApprovalStatus_APPROVAL_STATUS_APPROVED,
		}
		mockStore.UserApprovalRecords.Upsert(context.Background(), record)
	}
	
	// Add approvals for version-2
	for _, userId := range []string{"user-3"} {
		record := &pb.UserApprovalRecord{
			VersionId: version2Id,
			UserId:    userId,
			Status:    pb.ApprovalStatus_APPROVAL_STATUS_APPROVED,
		}
		mockStore.UserApprovalRecords.Upsert(context.Background(), record)
	}
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 2,
	}
	
	// Test version-1 (should be allowed)
	version1 := &pb.DeploymentVersion{
		Id: version1Id,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result1, err := evaluator.Evaluate(context.Background(), rule, version1, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error for version-1, got %v", err)
	}
	
	if !result1.Allowed {
		t.Error("Expected version-1 to be allowed")
	}
	
	// Test version-2 (should be denied)
	version2 := &pb.DeploymentVersion{
		Id: version2Id,
	}
	
	result2, err := evaluator.Evaluate(context.Background(), rule, version2, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error for version-2, got %v", err)
	}
	
	if result2.Allowed {
		t.Error("Expected version-2 to be denied")
	}
	
	// Verify approvers counts
	approvers1, ok := result1.Details["approvers"].([]string)
	if !ok || len(approvers1) != 2 {
		t.Errorf("Expected 2 approvers for version-1, got %d", len(approvers1))
	}
	
	approvers2, ok := result2.Details["approvers"].([]string)
	if !ok || len(approvers2) != 1 {
		t.Errorf("Expected 1 approver for version-2, got %d", len(approvers2))
	}
}

func TestAnyApprovalEvaluator_Evaluate_ResultStructure(t *testing.T) {
	versionId := "version-1"
	approvers := []string{"user-1"}
	mockStore := createMockStore(versionId, approvers)
	
	evaluator := NewAnyApprovalEvaluator(mockStore)
	
	rule := &pb.AnyApprovalRule{
		MinApprovals: 1,
	}
	
	version := &pb.DeploymentVersion{
		Id: versionId,
	}
	
	releaseTarget := &pb.ReleaseTarget{
		Id: "target-1",
	}
	
	result, err := evaluator.Evaluate(context.Background(), rule, version, releaseTarget)
	
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	
	// Verify result has proper structure
	if result.Details == nil {
		t.Error("Expected Details to be initialized")
	}
	
	if _, ok := result.Details["min_approvals"]; !ok {
		t.Error("Expected Details to contain 'min_approvals'")
	}
	
	if _, ok := result.Details["approvers"]; !ok {
		t.Error("Expected Details to contain 'approvers'")
	}
	
	if result.Reason == "" {
		t.Error("Expected Reason to be set")
	}
}
