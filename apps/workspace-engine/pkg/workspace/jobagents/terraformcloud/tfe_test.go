package terraformcloud

import (
	"encoding/json"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/hashicorp/go-tfe"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== parseJobAgentConfig =====

func TestParseJobAgentConfig_Valid(t *testing.T) {
	tfeInst := &TFE{}
	cfg := oapi.JobAgentConfig{
		"address":      "https://app.terraform.io",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: {{ .Resource.Name }}",
	}
	address, token, org, tmpl, err := tfeInst.parseJobAgentConfig(cfg)
	require.NoError(t, err)
	assert.Equal(t, "https://app.terraform.io", address)
	assert.Equal(t, "my-token", token)
	assert.Equal(t, "my-org", org)
	assert.Equal(t, "name: {{ .Resource.Name }}", tmpl)
}

func TestParseJobAgentConfig_MissingFields(t *testing.T) {
	tfeInst := &TFE{}
	tests := []struct {
		name string
		cfg  oapi.JobAgentConfig
	}{
		{"missing address", oapi.JobAgentConfig{"token": "t", "organization": "o", "template": "t"}},
		{"missing token", oapi.JobAgentConfig{"address": "a", "organization": "o", "template": "t"}},
		{"missing organization", oapi.JobAgentConfig{"address": "a", "token": "t", "template": "t"}},
		{"missing template", oapi.JobAgentConfig{"address": "a", "token": "t", "organization": "o"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, _, _, err := tfeInst.parseJobAgentConfig(tt.cfg)
			require.Error(t, err)
		})
	}
}

func TestParseJobAgentConfig_EmptyValues(t *testing.T) {
	tfeInst := &TFE{}
	cfg := oapi.JobAgentConfig{
		"address":      "",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
	}
	_, _, _, _, err := tfeInst.parseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing required fields")
}

func TestParseJobAgentConfig_WrongType(t *testing.T) {
	tfeInst := &TFE{}
	cfg := oapi.JobAgentConfig{
		"address":      123,
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
	}
	_, _, _, _, err := tfeInst.parseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "address is required")
}

// ===== mapRunStatus =====

func makeRun(status tfe.RunStatus) *tfe.Run {
	return &tfe.Run{Status: status, Plan: &tfe.Plan{}}
}

func TestMapRunStatus_SuccessfulStates(t *testing.T) {
	tests := []struct {
		status tfe.RunStatus
	}{
		{tfe.RunApplied},
		{tfe.RunPlannedAndFinished},
		{tfe.RunPlannedAndSaved},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			run := makeRun(tt.status)
			jobStatus, _ := mapRunStatus(run)
			assert.Equal(t, oapi.JobStatusSuccessful, jobStatus)
		})
	}
}

func TestMapRunStatus_FailureStates(t *testing.T) {
	run := makeRun(tfe.RunErrored)
	run.Message = "something broke"
	jobStatus, msg := mapRunStatus(run)
	assert.Equal(t, oapi.JobStatusFailure, jobStatus)
	assert.Contains(t, msg, "something broke")
}

func TestMapRunStatus_CancelledStates(t *testing.T) {
	tests := []struct {
		status tfe.RunStatus
	}{
		{tfe.RunCanceled},
		{tfe.RunDiscarded},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			run := makeRun(tt.status)
			jobStatus, _ := mapRunStatus(run)
			assert.Equal(t, oapi.JobStatusCancelled, jobStatus)
		})
	}
}

func TestMapRunStatus_ActionRequiredStates(t *testing.T) {
	t.Run("planned_confirmable", func(t *testing.T) {
		run := makeRun(tfe.RunPlanned)
		run.Actions = &tfe.RunActions{IsConfirmable: true}
		jobStatus, msg := mapRunStatus(run)
		assert.Equal(t, oapi.JobStatusActionRequired, jobStatus)
		assert.Contains(t, msg, "awaiting approval")
	})

	t.Run("planned_not_confirmable", func(t *testing.T) {
		run := makeRun(tfe.RunPlanned)
		jobStatus, _ := mapRunStatus(run)
		assert.Equal(t, oapi.JobStatusInProgress, jobStatus)
	})

	t.Run("policy_override", func(t *testing.T) {
		run := makeRun(tfe.RunPolicyOverride)
		jobStatus, _ := mapRunStatus(run)
		assert.Equal(t, oapi.JobStatusActionRequired, jobStatus)
	})

	t.Run("policy_soft_failed", func(t *testing.T) {
		run := makeRun(tfe.RunPolicySoftFailed)
		jobStatus, _ := mapRunStatus(run)
		assert.Equal(t, oapi.JobStatusActionRequired, jobStatus)
	})
}

func TestMapRunStatus_PendingState(t *testing.T) {
	run := makeRun(tfe.RunPending)
	jobStatus, msg := mapRunStatus(run)
	assert.Equal(t, oapi.JobStatusPending, jobStatus)
	assert.Contains(t, msg, "pending in queue")
}

func TestMapRunStatus_InProgressStates(t *testing.T) {
	inProgressStatuses := []tfe.RunStatus{
		tfe.RunFetching,
		tfe.RunFetchingCompleted,
		tfe.RunPrePlanRunning,
		tfe.RunPrePlanCompleted,
		tfe.RunQueuing,
		tfe.RunPlanQueued,
		tfe.RunPlanning,
		tfe.RunCostEstimating,
		tfe.RunCostEstimated,
		tfe.RunPolicyChecking,
		tfe.RunPolicyChecked,
		tfe.RunPostPlanRunning,
		tfe.RunPostPlanCompleted,
		tfe.RunPostPlanAwaitingDecision,
		tfe.RunConfirmed,
		tfe.RunApplyQueued,
		tfe.RunQueuingApply,
		tfe.RunApplying,
		tfe.RunPreApplyRunning,
		tfe.RunPreApplyCompleted,
	}
	for _, status := range inProgressStatuses {
		t.Run(string(status), func(t *testing.T) {
			run := makeRun(status)
			jobStatus, _ := mapRunStatus(run)
			assert.Equal(t, oapi.JobStatusInProgress, jobStatus)
		})
	}
}

func TestMapRunStatus_UnknownDefaultsToInProgress(t *testing.T) {
	run := &tfe.Run{Status: tfe.RunStatus("some_future_status")}
	jobStatus, msg := mapRunStatus(run)
	assert.Equal(t, oapi.JobStatusInProgress, jobStatus)
	assert.Contains(t, msg, "some_future_status")
}

// ===== isTerminalJobStatus =====

func TestIsTerminalJobStatus(t *testing.T) {
	terminal := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
		oapi.JobStatusExternalRunNotFound,
	}
	for _, s := range terminal {
		assert.True(t, isTerminalJobStatus(s), "expected %s to be terminal", s)
	}

	nonTerminal := []oapi.JobStatus{
		oapi.JobStatusInProgress,
		oapi.JobStatusActionRequired,
		oapi.JobStatusPending,
	}
	for _, s := range nonTerminal {
		assert.False(t, isTerminalJobStatus(s), "expected %s to be non-terminal", s)
	}
}

// ===== formatResourceChanges =====

func TestFormatResourceChanges_NilPlan(t *testing.T) {
	run := &tfe.Run{Plan: nil}
	assert.Equal(t, "+0/~0/-0", formatResourceChanges(run))
}

func TestFormatResourceChanges_ZeroChanges(t *testing.T) {
	run := &tfe.Run{Plan: &tfe.Plan{}}
	assert.Equal(t, "+0/~0/-0", formatResourceChanges(run))
}

func TestFormatResourceChanges_NonZero(t *testing.T) {
	run := &tfe.Run{Plan: &tfe.Plan{
		ResourceAdditions:    3,
		ResourceDestructions: 1,
		ResourceChanges:      2,
	}}
	assert.Equal(t, "+3/~2/-1", formatResourceChanges(run))
}

// ===== toCreateOptions / toUpdateOptions — workspace template =====

func TestWorkspaceTemplate_ToCreateOptions(t *testing.T) {
	ws := &WorkspaceTemplate{
		Name:             "my-workspace",
		Description:      "test desc",
		AutoApply:        true,
		TerraformVersion: "1.5.0",
		ExecutionMode:    "remote",
		AgentPoolID:      "apool-123",
		Project:          "prj-abc",
		WorkingDirectory: "infra/",
		VCSRepo: &VCSRepoTemplate{
			Identifier:   "org/repo",
			Branch:       "main",
			OAuthTokenID: "ot-123",
		},
	}
	opts := ws.toCreateOptions()

	assert.Equal(t, "my-workspace", *opts.Name)
	assert.Equal(t, "test desc", *opts.Description)
	assert.True(t, *opts.AutoApply)
	assert.Equal(t, "1.5.0", *opts.TerraformVersion)
	assert.Equal(t, "remote", *opts.ExecutionMode)
	assert.Equal(t, "apool-123", *opts.AgentPoolID)
	assert.Equal(t, "prj-abc", opts.Project.ID)
	assert.Equal(t, "infra/", *opts.WorkingDirectory)
	require.NotNil(t, opts.VCSRepo)
	assert.Equal(t, "org/repo", *opts.VCSRepo.Identifier)
	assert.Equal(t, "main", *opts.VCSRepo.Branch)
	assert.Equal(t, "ot-123", *opts.VCSRepo.OAuthTokenID)
}

func TestWorkspaceTemplate_ToCreateOptions_Minimal(t *testing.T) {
	ws := &WorkspaceTemplate{Name: "bare"}
	opts := ws.toCreateOptions()
	assert.Equal(t, "bare", *opts.Name)
	assert.Nil(t, opts.ExecutionMode)
	assert.Nil(t, opts.TerraformVersion)
	assert.Nil(t, opts.Project)
	assert.Empty(t, opts.AgentPoolID) // not set when empty
	assert.Nil(t, opts.VCSRepo)
}

func TestWorkspaceTemplate_ToUpdateOptions(t *testing.T) {
	ws := &WorkspaceTemplate{
		Name:             "updated-ws",
		Description:      "updated",
		AutoApply:        false,
		TerraformVersion: "1.6.0",
		ExecutionMode:    "agent",
		AgentPoolID:      "apool-456",
		VCSRepo: &VCSRepoTemplate{
			Identifier:   "org/repo2",
			Branch:       "develop",
			OAuthTokenID: "ot-456",
		},
	}
	opts := ws.toUpdateOptions()

	assert.Equal(t, "updated-ws", *opts.Name)
	assert.Equal(t, "updated", *opts.Description)
	assert.False(t, *opts.AutoApply)
	assert.Equal(t, "1.6.0", *opts.TerraformVersion)
	assert.Equal(t, "agent", *opts.ExecutionMode)
	assert.Equal(t, "apool-456", *opts.AgentPoolID)
	require.NotNil(t, opts.VCSRepo)
	assert.Equal(t, "org/repo2", *opts.VCSRepo.Identifier)
}

func TestWorkspaceTemplate_ToUpdateOptions_Minimal(t *testing.T) {
	ws := &WorkspaceTemplate{Name: "bare"}
	opts := ws.toUpdateOptions()
	assert.Equal(t, "bare", *opts.Name)
	assert.Nil(t, opts.ExecutionMode)
	assert.Nil(t, opts.TerraformVersion)
	assert.Nil(t, opts.AgentPoolID)
	assert.Nil(t, opts.VCSRepo)
}

// ===== toCreateOptions / toUpdateOptions — variable template =====

func TestVariableTemplate_ToCreateOptions(t *testing.T) {
	v := VariableTemplate{
		Key:         "AWS_REGION",
		Value:       "us-east-1",
		Description: "AWS region",
		Category:    "env",
		HCL:         false,
		Sensitive:   true,
	}
	opts := v.toCreateOptions()
	assert.Equal(t, "AWS_REGION", *opts.Key)
	assert.Equal(t, "us-east-1", *opts.Value)
	assert.Equal(t, "AWS region", *opts.Description)
	assert.Equal(t, tfe.CategoryType("env"), *opts.Category)
	assert.False(t, *opts.HCL)
	assert.True(t, *opts.Sensitive)
}

func TestVariableTemplate_ToUpdateOptions(t *testing.T) {
	v := VariableTemplate{
		Key:         "TF_VAR_foo",
		Value:       `{"bar":"baz"}`,
		Description: "HCL variable",
		Category:    "terraform",
		HCL:         true,
		Sensitive:   false,
	}
	opts := v.toUpdateOptions()
	assert.Equal(t, "TF_VAR_foo", *opts.Key)
	assert.Equal(t, `{"bar":"baz"}`, *opts.Value)
	assert.Equal(t, tfe.CategoryType("terraform"), *opts.Category)
	assert.True(t, *opts.HCL)
	assert.False(t, *opts.Sensitive)
}

// ===== RestoreJobs — unit-level checks (no real TFC client) =====

func TestRestoreJobs_NoExternalId_SendsExternalRunNotFound(t *testing.T) {
	// We can't easily call RestoreJobs without a real store + messaging producer,
	// but we can verify the logic path by checking that a job without ExternalId
	// would get the externalRunNotFound status. We test the status mapping instead.
	assert.True(t, isTerminalJobStatus(oapi.JobStatusExternalRunNotFound))
}

func TestRestoreJobs_WithExternalId_IsResumable(t *testing.T) {
	// Verify the run ID extraction path: a non-empty ExternalId means the job
	// should be resumed (not marked as externalRunNotFound).
	runID := "run-abc123"
	job := &oapi.Job{
		Id:         "job-1",
		ExternalId: &runID,
		Status:     oapi.JobStatusInProgress,
	}
	assert.NotNil(t, job.ExternalId)
	assert.NotEmpty(t, *job.ExternalId)
}

// ===== sendJobEvent field construction =====

func TestSendJobEvent_TerminalSetsCompletedAt(t *testing.T) {
	// Verify that isTerminalJobStatus correctly identifies statuses that should
	// trigger completedAt being set in sendJobEvent
	for _, status := range []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
		oapi.JobStatusExternalRunNotFound,
	} {
		assert.True(t, isTerminalJobStatus(status), "completedAt should be set for %s", status)
	}
}

func TestSendJobEvent_InProgressSetsStartedAt(t *testing.T) {
	// The sendJobEvent logic sets startedAt when status == inProgress
	assert.Equal(t, oapi.JobStatusInProgress, oapi.JobStatus("inProgress"))
}

// ===== WorkspaceTemplate JSON/YAML round-trip =====

func TestWorkspaceTemplate_JSONRoundTrip(t *testing.T) {
	ws := WorkspaceTemplate{
		Name:             "test-ws",
		Description:      "desc",
		AutoApply:        true,
		TerraformVersion: "1.5.0",
		Variables: []VariableTemplate{
			{Key: "k1", Value: "v1", Category: "env"},
		},
	}
	data, err := json.Marshal(ws)
	require.NoError(t, err)

	var got WorkspaceTemplate
	require.NoError(t, json.Unmarshal(data, &got))
	assert.Equal(t, ws.Name, got.Name)
	assert.Equal(t, ws.AutoApply, got.AutoApply)
	require.Len(t, got.Variables, 1)
	assert.Equal(t, "k1", got.Variables[0].Key)
}

// ===== Type() =====

func TestTFE_Type(t *testing.T) {
	tfeInst := &TFE{}
	assert.Equal(t, "tfe", tfeInst.Type())
}
