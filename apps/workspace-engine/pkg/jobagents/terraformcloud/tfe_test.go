package terraformcloud

import (
	"encoding/json"
	"testing"

	"github.com/hashicorp/go-tfe"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

// ===== parseJobAgentConfig =====

func TestParseJobAgentConfig_Valid(t *testing.T) {
	cfg := oapi.JobAgentConfig{
		"address":      "https://app.terraform.io",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: {{ .Resource.Name }}",
		"webhookUrl":   "https://ctrlplane.example.com/api/tfe/webhook",
	}
	parsed, err := parseJobAgentConfig(cfg)
	require.NoError(t, err)
	assert.Equal(t, "https://app.terraform.io", parsed.address)
	assert.Equal(t, "my-token", parsed.token)
	assert.Equal(t, "my-org", parsed.organization)
	assert.Equal(t, "name: {{ .Resource.Name }}", parsed.template)
	assert.Equal(t, "https://ctrlplane.example.com/api/tfe/webhook", parsed.webhookUrl)
	assert.True(t, parsed.triggerRunOnChange)
}

func TestParseJobAgentConfig_MissingWebhookUrl(t *testing.T) {
	cfg := oapi.JobAgentConfig{
		"address":      "https://app.terraform.io",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
	}
	_, err := parseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "webhookUrl is required")
}

func TestParseJobAgentConfig_WithWebhookUrl(t *testing.T) {
	cfg := oapi.JobAgentConfig{
		"address":      "https://app.terraform.io",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
		"webhookUrl":   "https://ctrlplane.example.com/api/tfe/webhook",
	}
	parsed, err := parseJobAgentConfig(cfg)
	require.NoError(t, err)
	assert.Equal(t, "https://ctrlplane.example.com/api/tfe/webhook", parsed.webhookUrl)
}

func TestParseJobAgentConfig_TriggerRunOnChange(t *testing.T) {
	t.Run("defaults to true", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"address":      "https://app.terraform.io",
			"token":        "t",
			"organization": "o",
			"template":     "t",
			"webhookUrl":   "https://example.com/api/tfe/webhook",
		}
		parsed, err := parseJobAgentConfig(cfg)
		require.NoError(t, err)
		assert.True(t, parsed.triggerRunOnChange)
	})

	t.Run("bool false", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"address":            "https://app.terraform.io",
			"token":              "t",
			"organization":       "o",
			"template":           "t",
			"webhookUrl":         "https://example.com/api/tfe/webhook",
			"triggerRunOnChange": false,
		}
		parsed, err := parseJobAgentConfig(cfg)
		require.NoError(t, err)
		assert.False(t, parsed.triggerRunOnChange)
	})

	t.Run("string false", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"address":            "https://app.terraform.io",
			"token":              "t",
			"organization":       "o",
			"template":           "t",
			"webhookUrl":         "https://example.com/api/tfe/webhook",
			"triggerRunOnChange": "false",
		}
		parsed, err := parseJobAgentConfig(cfg)
		require.NoError(t, err)
		assert.False(t, parsed.triggerRunOnChange)
	})

	t.Run("bool true", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"address":            "https://app.terraform.io",
			"token":              "t",
			"organization":       "o",
			"template":           "t",
			"webhookUrl":         "https://example.com/api/tfe/webhook",
			"triggerRunOnChange": true,
		}
		parsed, err := parseJobAgentConfig(cfg)
		require.NoError(t, err)
		assert.True(t, parsed.triggerRunOnChange)
	})
}

func TestParseJobAgentConfig_MissingFields(t *testing.T) {
	tests := []struct {
		name string
		cfg  oapi.JobAgentConfig
	}{
		{
			"missing address",
			oapi.JobAgentConfig{"token": "t", "organization": "o", "template": "t"},
		},
		{
			"missing token",
			oapi.JobAgentConfig{"address": "a", "organization": "o", "template": "t"},
		},
		{
			"missing organization",
			oapi.JobAgentConfig{"address": "a", "token": "t", "template": "t"},
		},
		{
			"missing template",
			oapi.JobAgentConfig{"address": "a", "token": "t", "organization": "o"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseJobAgentConfig(tt.cfg)
			require.Error(t, err)
		})
	}
}

func TestParseJobAgentConfig_EmptyValues(t *testing.T) {
	cfg := oapi.JobAgentConfig{
		"address":      "",
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
	}
	_, err := parseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing required fields")
}

func TestParseJobAgentConfig_WrongType(t *testing.T) {
	cfg := oapi.JobAgentConfig{
		"address":      123,
		"token":        "my-token",
		"organization": "my-org",
		"template":     "name: foo",
	}
	_, err := parseJobAgentConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "address is required")
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
	assert.Empty(t, opts.AgentPoolID)
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
	assert.JSONEq(t, `{"bar":"baz"}`, *opts.Value)
	assert.Equal(t, tfe.CategoryType("terraform"), *opts.Category)
	assert.True(t, *opts.HCL)
	assert.False(t, *opts.Sensitive)
}

// ===== WorkspaceTemplate JSON round-trip =====

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
