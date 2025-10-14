package db

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedUserApprovalRecords(t *testing.T, actualRecords []*oapi.UserApprovalRecord, expectedRecords []*oapi.UserApprovalRecord) {
	t.Helper()
	if len(actualRecords) != len(expectedRecords) {
		t.Fatalf("expected %d user approval records, got %d", len(expectedRecords), len(actualRecords))
	}

	for _, expectedRecord := range expectedRecords {
		var actualRecord *oapi.UserApprovalRecord
		for _, ar := range actualRecords {
			if ar.UserId == expectedRecord.UserId &&
				ar.VersionId == expectedRecord.VersionId {
				actualRecord = ar
				break
			}
		}

		if actualRecord == nil {
			t.Fatalf("expected user approval record with user_id %v and version_id %v not found", expectedRecord.UserId, expectedRecord.VersionId)
		}

		if actualRecord.UserId != expectedRecord.UserId {
			t.Fatalf("expected user_id %v, got %v", expectedRecord.UserId, actualRecord.UserId)
		}

		if actualRecord.VersionId != expectedRecord.VersionId {
			t.Fatalf("expected version_id %v, got %v", expectedRecord.VersionId, actualRecord.VersionId)
		}

		if actualRecord.Status != expectedRecord.Status {
			t.Fatalf("expected status %v, got %v", expectedRecord.Status, actualRecord.Status)
		}

		compareStrPtr(t, actualRecord.Reason, expectedRecord.Reason)

		if actualRecord.CreatedAt == "" {
			t.Fatalf("expected created_at to be set")
		}
	}
}

func TestDBUserApprovalRecords_EmptyResult(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	records, err := getUserApprovalRecords(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(records) != 0 {
		t.Fatalf("expected 0 user approval records for new workspace, got %d", len(records))
	}
}

func TestDBUserApprovalRecords_SingleRecord(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create required dependencies
	userID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test User", "test@example.com")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	systemID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		systemID, "Test System", "test-system", workspaceID)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	environmentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environmentID, "Test Environment", systemID)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	deploymentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deploymentID, "Test Deployment", "test-deployment", "Test deployment description", systemID)
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	versionID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		versionID, "v1.0.0", "latest", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version: %v", err)
	}

	// Insert approval record
	reason := "Looks good to me"
	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, reason, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), versionID, environmentID, userID, "approved", reason, time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record: %v", err)
	}

	records, err := getUserApprovalRecords(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	expectedRecords := []*oapi.UserApprovalRecord{
		{
			UserId:    userID,
			VersionId: versionID,
			Status:    oapi.ApprovalStatusApproved,
			Reason:    &reason,
		},
	}

	validateRetrievedUserApprovalRecords(t, records, expectedRecords)
}

func TestDBUserApprovalRecords_MultipleRecords(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create users
	user1ID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		user1ID, "User 1", "user1@example.com")
	if err != nil {
		t.Fatalf("failed to create user 1: %v", err)
	}

	user2ID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		user2ID, "User 2", "user2@example.com")
	if err != nil {
		t.Fatalf("failed to create user 2: %v", err)
	}

	// Create system and environment
	systemID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		systemID, "Test System", "test-system", workspaceID)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	environmentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environmentID, "Test Environment", systemID)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	// Create deployment
	deploymentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deploymentID, "Test Deployment", "test-deployment", "Test deployment description", systemID)
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create multiple versions
	version1ID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		version1ID, "v1.0.0", "latest", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version 1: %v", err)
	}

	version2ID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		version2ID, "v2.0.0", "v2", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version 2: %v", err)
	}

	// Insert approval records
	reason1 := "Approved by user 1"
	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, reason, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), version1ID, environmentID, user1ID, "approved", reason1, time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record 1: %v", err)
	}

	reason2 := "Needs more testing"
	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, reason, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), version2ID, environmentID, user2ID, "rejected", reason2, time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record 2: %v", err)
	}

	// Another approval by user1 for version2
	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), version2ID, environmentID, user1ID, "approved", time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record 3: %v", err)
	}

	records, err := getUserApprovalRecords(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	expectedRecords := []*oapi.UserApprovalRecord{
		{
			UserId:    user1ID,
			VersionId: version1ID,
			Status:    oapi.ApprovalStatusApproved,
			Reason:    &reason1,
		},
		{
			UserId:    user2ID,
			VersionId: version2ID,
			Status:    oapi.ApprovalStatusRejected,
			Reason:    &reason2,
		},
		{
			UserId:    user1ID,
			VersionId: version2ID,
			Status:    oapi.ApprovalStatusApproved,
			Reason:    nil,
		},
	}

	validateRetrievedUserApprovalRecords(t, records, expectedRecords)
}

func TestDBUserApprovalRecords_WorkspaceIsolation(t *testing.T) {
	// Create two separate workspaces
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	defer conn1.Release()

	workspaceID2, conn2 := setupTestWithWorkspace(t)
	defer conn2.Release()

	// Create user for workspace 1
	user1ID := uuid.New().String()
	_, err := conn1.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		user1ID, "User 1", "user1@example.com")
	if err != nil {
		t.Fatalf("failed to create user1: %v", err)
	}

	system1ID := uuid.New().String()
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		system1ID, "System 1", "system-1", workspaceID1)
	if err != nil {
		t.Fatalf("failed to create system1: %v", err)
	}

	environment1ID := uuid.New().String()
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environment1ID, "Environment 1", system1ID)
	if err != nil {
		t.Fatalf("failed to create environment1: %v", err)
	}

	deployment1ID := uuid.New().String()
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deployment1ID, "Deployment 1", "deployment-1", "Deployment 1 description", system1ID)
	if err != nil {
		t.Fatalf("failed to create deployment1: %v", err)
	}

	version1ID := uuid.New().String()
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		version1ID, "v1.0.0", "latest", deployment1ID)
	if err != nil {
		t.Fatalf("failed to create version1: %v", err)
	}

	reason1 := "Workspace 1 approval"
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, reason, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), version1ID, environment1ID, user1ID, "approved", reason1, time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record for workspace1: %v", err)
	}

	// Create user for workspace 2
	user2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		user2ID, "User 2", "user2@example.com")
	if err != nil {
		t.Fatalf("failed to create user2: %v", err)
	}

	system2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		system2ID, "System 2", "system-2", workspaceID2)
	if err != nil {
		t.Fatalf("failed to create system2: %v", err)
	}

	environment2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environment2ID, "Environment 2", system2ID)
	if err != nil {
		t.Fatalf("failed to create environment2: %v", err)
	}

	deployment2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deployment2ID, "Deployment 2", "deployment-2", "Deployment 2 description", system2ID)
	if err != nil {
		t.Fatalf("failed to create deployment2: %v", err)
	}

	version2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		version2ID, "v2.0.0", "latest", deployment2ID)
	if err != nil {
		t.Fatalf("failed to create version2: %v", err)
	}

	reason2 := "Workspace 2 rejection"
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, reason, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		uuid.New().String(), version2ID, environment2ID, user2ID, "rejected", reason2, time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record for workspace2: %v", err)
	}

	// Verify workspace 1 only sees its records
	records1, err := getUserApprovalRecords(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors for workspace1, got %v", err)
	}

	expectedRecords1 := []*oapi.UserApprovalRecord{
		{
			UserId:    user1ID,
			VersionId: version1ID,
			Status:    oapi.ApprovalStatusApproved,
			Reason:    &reason1,
		},
	}
	validateRetrievedUserApprovalRecords(t, records1, expectedRecords1)

	// Verify workspace 2 only sees its records
	records2, err := getUserApprovalRecords(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors for workspace2, got %v", err)
	}

	expectedRecords2 := []*oapi.UserApprovalRecord{
		{
			UserId:    user2ID,
			VersionId: version2ID,
			Status:    oapi.ApprovalStatusRejected,
			Reason:    &reason2,
		},
	}
	validateRetrievedUserApprovalRecords(t, records2, expectedRecords2)
}

func TestDBUserApprovalRecords_NonexistentWorkspace(t *testing.T) {
	// Setup test environment (needed for DB connection and skip logic)
	_, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Try to get records for a non-existent workspace
	nonExistentWorkspaceID := uuid.New().String()

	records, err := getUserApprovalRecords(t.Context(), nonExistentWorkspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Should return empty list, not error
	if len(records) != 0 {
		t.Fatalf("expected 0 user approval records for non-existent workspace, got %d", len(records))
	}
}

func TestDBUserApprovalRecords_NoReasonProvided(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create required dependencies
	userID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test User", "test@example.com")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	systemID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		systemID, "Test System", "test-system", workspaceID)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	environmentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environmentID, "Test Environment", systemID)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	deploymentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deploymentID, "Test Deployment", "test-deployment", "Test deployment description", systemID)
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	versionID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		versionID, "v1.0.0", "latest", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version: %v", err)
	}

	// Insert approval record without a reason
	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), versionID, environmentID, userID, "approved", time.Now())
	if err != nil {
		t.Fatalf("failed to create approval record: %v", err)
	}

	records, err := getUserApprovalRecords(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	if records[0].Reason != nil {
		t.Fatalf("expected reason to be nil, got %v", *records[0].Reason)
	}

	if records[0].Status != oapi.ApprovalStatusApproved {
		t.Fatalf("expected status to be approved, got %v", records[0].Status)
	}
}

func TestDBUserApprovalRecords_DifferentStatuses(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create required dependencies
	userID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test User", "test@example.com")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	systemID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO system (id, name, slug, workspace_id) VALUES ($1, $2, $3, $4)`,
		systemID, "Test System", "test-system", workspaceID)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	environmentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO environment (id, name, system_id) VALUES ($1, $2, $3)`,
		environmentID, "Test Environment", systemID)
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	deploymentID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment (id, name, slug, description, system_id) VALUES ($1, $2, $3, $4, $5)`,
		deploymentID, "Test Deployment", "test-deployment", "Test deployment description", systemID)
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Test approved status
	versionApprovedID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		versionApprovedID, "v1.0.0", "latest", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version: %v", err)
	}

	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), versionApprovedID, environmentID, userID, "approved", time.Now())
	if err != nil {
		t.Fatalf("failed to create approved record: %v", err)
	}

	// Test rejected status
	versionRejectedID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO deployment_version (id, name, tag, deployment_id) VALUES ($1, $2, $3, $4)`,
		versionRejectedID, "v2.0.0", "v2", deploymentID)
	if err != nil {
		t.Fatalf("failed to create deployment version: %v", err)
	}

	_, err = conn.Exec(t.Context(),
		`INSERT INTO policy_rule_any_approval_record 
		(id, deployment_version_id, environment_id, user_id, status, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), versionRejectedID, environmentID, userID, "rejected", time.Now())
	if err != nil {
		t.Fatalf("failed to create rejected record: %v", err)
	}

	records, err := getUserApprovalRecords(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}

	// Verify we have one approved and one rejected
	approvedCount := 0
	rejectedCount := 0
	for _, record := range records {
		switch record.Status {
		case oapi.ApprovalStatusApproved:
			approvedCount++
		case oapi.ApprovalStatusRejected:
			rejectedCount++
		}
	}

	if approvedCount != 1 {
		t.Fatalf("expected 1 approved record, got %d", approvedCount)
	}

	if rejectedCount != 1 {
		t.Fatalf("expected 1 rejected record, got %d", rejectedCount)
	}
}
