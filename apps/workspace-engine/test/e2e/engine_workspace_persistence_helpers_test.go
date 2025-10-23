package e2e

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
)

// Shared helper functions for workspace persistence tests
// Used by both disk and GCS persistence tests

func verifyResourcesEqual(t *testing.T, expected, actual *oapi.Resource, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: resource ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: resource name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	if actual.Kind != expected.Kind {
		t.Errorf("%s: resource kind mismatch: expected %s, got %s", context, expected.Kind, actual.Kind)
	}
	if actual.Version != expected.Version {
		t.Errorf("%s: resource version mismatch: expected %s, got %s", context, expected.Version, actual.Version)
	}
	if actual.Identifier != expected.Identifier {
		t.Errorf("%s: resource identifier mismatch: expected %s, got %s", context, expected.Identifier, actual.Identifier)
	}

	// Verify metadata
	if len(actual.Metadata) != len(expected.Metadata) {
		t.Errorf("%s: metadata length mismatch: expected %d, got %d", context, len(expected.Metadata), len(actual.Metadata))
	}
	for key, expectedValue := range expected.Metadata {
		if actualValue, ok := actual.Metadata[key]; !ok {
			t.Errorf("%s: metadata key %s missing", context, key)
		} else if actualValue != expectedValue {
			t.Errorf("%s: metadata[%s] mismatch: expected %s, got %s", context, key, expectedValue, actualValue)
		}
	}

	// Verify config (deep comparison would require reflection or JSON marshaling)
	if (expected.Config == nil) != (actual.Config == nil) {
		t.Errorf("%s: config nil mismatch", context)
	}

	// Verify timestamps
	if !actual.CreatedAt.Equal(expected.CreatedAt) {
		t.Errorf("%s: createdAt mismatch: expected %v, got %v", context, expected.CreatedAt, actual.CreatedAt)
	}

	// UpdatedAt is optional
	if (expected.UpdatedAt == nil) != (actual.UpdatedAt == nil) {
		t.Errorf("%s: updatedAt nil mismatch", context)
	} else if expected.UpdatedAt != nil && !actual.UpdatedAt.Equal(*expected.UpdatedAt) {
		t.Errorf("%s: updatedAt mismatch: expected %v, got %v", context, *expected.UpdatedAt, *actual.UpdatedAt)
	}
}

func verifyJobsEqual(t *testing.T, expected, actual *oapi.Job, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: job ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Status != expected.Status {
		t.Errorf("%s: job status mismatch: expected %s, got %s", context, expected.Status, actual.Status)
	}
	if actual.JobAgentId != expected.JobAgentId {
		t.Errorf("%s: job agent ID mismatch: expected %s, got %s", context, expected.JobAgentId, actual.JobAgentId)
	}
	if actual.ReleaseId != expected.ReleaseId {
		t.Errorf("%s: release ID mismatch: expected %s, got %s", context, expected.ReleaseId, actual.ReleaseId)
	}
	// ExternalId is optional
	if (expected.ExternalId == nil) != (actual.ExternalId == nil) {
		t.Errorf("%s: externalId nil mismatch", context)
	} else if expected.ExternalId != nil && *actual.ExternalId != *expected.ExternalId {
		t.Errorf("%s: external ID mismatch: expected %s, got %s", context, *expected.ExternalId, *actual.ExternalId)
	}

	// Verify metadata
	if len(actual.Metadata) != len(expected.Metadata) {
		t.Errorf("%s: metadata length mismatch: expected %d, got %d", context, len(expected.Metadata), len(actual.Metadata))
	}
	for key, expectedValue := range expected.Metadata {
		if actualValue, ok := actual.Metadata[key]; !ok {
			t.Errorf("%s: metadata key %s missing", context, key)
		} else if actualValue != expectedValue {
			t.Errorf("%s: metadata[%s] mismatch: expected %s, got %s", context, key, expectedValue, actualValue)
		}
	}

	// Verify timestamps
	if !actual.CreatedAt.Equal(expected.CreatedAt) {
		t.Errorf("%s: createdAt mismatch: expected %v, got %v", context, expected.CreatedAt, actual.CreatedAt)
	}
	if !actual.UpdatedAt.Equal(expected.UpdatedAt) {
		t.Errorf("%s: updatedAt mismatch: expected %v, got %v", context, expected.UpdatedAt, actual.UpdatedAt)
	}

	// Verify optional timestamps
	if (expected.StartedAt == nil) != (actual.StartedAt == nil) {
		t.Errorf("%s: startedAt nil mismatch", context)
	} else if expected.StartedAt != nil && !actual.StartedAt.Equal(*expected.StartedAt) {
		t.Errorf("%s: startedAt mismatch: expected %v, got %v", context, *expected.StartedAt, *actual.StartedAt)
	}

	if (expected.CompletedAt == nil) != (actual.CompletedAt == nil) {
		t.Errorf("%s: completedAt nil mismatch", context)
	} else if expected.CompletedAt != nil && !actual.CompletedAt.Equal(*expected.CompletedAt) {
		t.Errorf("%s: completedAt mismatch: expected %v, got %v", context, *expected.CompletedAt, *actual.CompletedAt)
	}
}

func verifyDeploymentsEqual(t *testing.T, expected, actual *oapi.Deployment, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: deployment ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: deployment name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	// Description is optional
	if (expected.Description == nil) != (actual.Description == nil) {
		t.Errorf("%s: description nil mismatch", context)
	} else if expected.Description != nil && *actual.Description != *expected.Description {
		t.Errorf("%s: deployment description mismatch: expected %s, got %s", context, *expected.Description, *actual.Description)
	}
	if actual.SystemId != expected.SystemId {
		t.Errorf("%s: system ID mismatch: expected %s, got %s", context, expected.SystemId, actual.SystemId)
	}
	// JobAgentId is optional
	if (expected.JobAgentId == nil) != (actual.JobAgentId == nil) {
		t.Errorf("%s: jobAgentId nil mismatch", context)
	} else if expected.JobAgentId != nil && *actual.JobAgentId != *expected.JobAgentId {
		t.Errorf("%s: job agent ID mismatch: expected %s, got %s", context, *expected.JobAgentId, *actual.JobAgentId)
	}
}

func verifySystemsEqual(t *testing.T, expected, actual *oapi.System, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: system ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: system name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	// Description is optional
	if (expected.Description == nil) != (actual.Description == nil) {
		t.Errorf("%s: description nil mismatch", context)
	} else if expected.Description != nil && *actual.Description != *expected.Description {
		t.Errorf("%s: system description mismatch: expected %s, got %s", context, *expected.Description, *actual.Description)
	}
	if actual.WorkspaceId != expected.WorkspaceId {
		t.Errorf("%s: workspace ID mismatch: expected %s, got %s", context, expected.WorkspaceId, actual.WorkspaceId)
	}
}

func verifyEnvironmentsEqual(t *testing.T, expected, actual *oapi.Environment, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: environment ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: environment name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	// Description is optional
	if (expected.Description == nil) != (actual.Description == nil) {
		t.Errorf("%s: description nil mismatch", context)
	} else if expected.Description != nil && *actual.Description != *expected.Description {
		t.Errorf("%s: environment description mismatch: expected %s, got %s", context, *expected.Description, *actual.Description)
	}
	if actual.SystemId != expected.SystemId {
		t.Errorf("%s: system ID mismatch: expected %s, got %s", context, expected.SystemId, actual.SystemId)
	}
}

func verifyJobAgentsEqual(t *testing.T, expected, actual *oapi.JobAgent, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: job agent ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: job agent name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	if actual.Type != expected.Type {
		t.Errorf("%s: job agent type mismatch: expected %s, got %s", context, expected.Type, actual.Type)
	}
	if actual.WorkspaceId != expected.WorkspaceId {
		t.Errorf("%s: workspace ID mismatch: expected %s, got %s", context, expected.WorkspaceId, actual.WorkspaceId)
	}
}

func verifyPoliciesEqual(t *testing.T, expected, actual *oapi.Policy, context string) {
	t.Helper()
	if actual.Id != expected.Id {
		t.Errorf("%s: policy ID mismatch: expected %s, got %s", context, expected.Id, actual.Id)
	}
	if actual.Name != expected.Name {
		t.Errorf("%s: policy name mismatch: expected %s, got %s", context, expected.Name, actual.Name)
	}
	// Description is optional
	if (expected.Description == nil) != (actual.Description == nil) {
		t.Errorf("%s: description nil mismatch", context)
	} else if expected.Description != nil && *actual.Description != *expected.Description {
		t.Errorf("%s: policy description mismatch: expected %s, got %s", context, *expected.Description, *actual.Description)
	}
	if actual.WorkspaceId != expected.WorkspaceId {
		t.Errorf("%s: workspace ID mismatch: expected %s, got %s", context, expected.WorkspaceId, actual.WorkspaceId)
	}

	// Verify rules array
	if len(actual.Rules) != len(expected.Rules) {
		t.Errorf("%s: rules length mismatch: expected %d, got %d", context, len(expected.Rules), len(actual.Rules))
	}

	// Verify selectors array
	if len(actual.Selectors) != len(expected.Selectors) {
		t.Errorf("%s: selectors length mismatch: expected %d, got %d", context, len(expected.Selectors), len(actual.Selectors))
	}
}

// Helper function to create pointer to time.Time
func ptrTime(t time.Time) *time.Time {
	return &t
}
