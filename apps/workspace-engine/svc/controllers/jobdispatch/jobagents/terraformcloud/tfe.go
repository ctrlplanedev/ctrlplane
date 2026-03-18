package terraformcloud

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/charmbracelet/log"
	"github.com/hashicorp/go-tfe"
	"sigs.k8s.io/yaml"
)

var _ types.Dispatchable = &TFE{}

const notificationConfigName = "ctrlplane-webhook"

// Setter persists job status updates.
type Setter interface {
	UpdateJob(
		ctx context.Context,
		jobID string,
		status oapi.JobStatus,
		message string,
		metadata map[string]string,
	) error
}

type TFE struct {
	setter Setter
}

type VCSRepoTemplate struct {
	Identifier        string `json:"identifier" yaml:"identifier"`
	Branch            string `json:"branch,omitempty" yaml:"branch,omitempty"`
	OAuthTokenID      string `json:"oauth_token_id,omitempty" yaml:"oauth_token_id,omitempty"`
	IngressSubmodules bool   `json:"ingress_submodules,omitempty" yaml:"ingress_submodules,omitempty"`
	TagsRegex         string `json:"tags_regex,omitempty" yaml:"tags_regex,omitempty"`
}

type WorkspaceTemplate struct {
	Name                string             `json:"name" yaml:"name"`
	Description         string             `json:"description,omitempty" yaml:"description,omitempty"`
	Project             string             `json:"project,omitempty" yaml:"project,omitempty"`
	ExecutionMode       string             `json:"execution_mode,omitempty" yaml:"execution_mode,omitempty"`
	AutoApply           bool               `json:"auto_apply,omitempty" yaml:"auto_apply,omitempty"`
	AllowDestroyPlan    bool               `json:"allow_destroy_plan,omitempty" yaml:"allow_destroy_plan,omitempty"`
	FileTriggersEnabled bool               `json:"file_triggers_enabled,omitempty" yaml:"file_triggers_enabled,omitempty"`
	GlobalRemoteState   bool               `json:"global_remote_state,omitempty" yaml:"global_remote_state,omitempty"`
	QueueAllRuns        bool               `json:"queue_all_runs,omitempty" yaml:"queue_all_runs,omitempty"`
	SpeculativeEnabled  bool               `json:"speculative_enabled,omitempty" yaml:"speculative_enabled,omitempty"`
	TerraformVersion    string             `json:"terraform_version,omitempty" yaml:"terraform_version,omitempty"`
	TriggerPrefixes     []string           `json:"trigger_prefixes,omitempty" yaml:"trigger_prefixes,omitempty"`
	TriggerPatterns     []string           `json:"trigger_patterns,omitempty" yaml:"trigger_patterns,omitempty"`
	WorkingDirectory    string             `json:"working_directory,omitempty" yaml:"working_directory,omitempty"`
	AgentPoolID         string             `json:"agent_pool_id,omitempty" yaml:"agent_pool_id,omitempty"`
	VCSRepo             *VCSRepoTemplate   `json:"vcs_repo,omitempty" yaml:"vcs_repo,omitempty"`
	Variables           []VariableTemplate `json:"variables,omitempty" yaml:"variables,omitempty"`
}

type VariableTemplate struct {
	Key         string `json:"key" yaml:"key"`
	Value       string `json:"value,omitempty" yaml:"value,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	Category    string `json:"category" yaml:"category"`
	HCL         bool   `json:"hcl,omitempty" yaml:"hcl,omitempty"`
	Sensitive   bool   `json:"sensitive,omitempty" yaml:"sensitive,omitempty"`
}

type tfeConfig struct {
	address            string
	token              string
	organization       string
	template           string
	webhookUrl         string
	triggerRunOnChange bool
}

func New(setter Setter) *TFE {
	return &TFE{setter: setter}
}

func (t *TFE) Type() string {
	return "tfe"
}

func (t *TFE) Dispatch(ctx context.Context, job *oapi.Job) error {
	dispatchCtx := job.DispatchContext
	cfg, err := parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	workspace, err := templateWorkspace(job.DispatchContext, cfg.template)
	if err != nil {
		return fmt.Errorf("failed to generate workspace from template: %w", err)
	}

	client, err := getClient(cfg.address, cfg.token)
	if err != nil {
		t.updateJobStatus(ctx, job.Id, oapi.JobStatusFailure,
			fmt.Sprintf("failed to create Terraform Cloud client: %s", err.Error()), nil)
		return fmt.Errorf("failed to create Terraform Cloud client: %w", err)
	}

	targetWorkspace, err := upsertWorkspace(ctx, client, cfg.organization, workspace)
	if err != nil {
		t.updateJobStatus(ctx, job.Id, oapi.JobStatusFailure,
			fmt.Sprintf("failed to upsert workspace: %s", err.Error()), nil)
		return fmt.Errorf("failed to upsert workspace: %w", err)
	}

	if len(workspace.Variables) > 0 {
		if err := syncVariables(ctx, client, targetWorkspace.ID, workspace.Variables); err != nil {
			t.updateJobStatus(ctx, job.Id, oapi.JobStatusFailure,
				fmt.Sprintf("failed to sync variables: %s", err.Error()), nil)
			return fmt.Errorf("failed to sync variables: %w", err)
		}
	}

	webhookSecret := os.Getenv("TFE_WEBHOOK_SECRET")
	if cfg.webhookUrl != "" {
		if err := ensureNotificationConfig(ctx, client, targetWorkspace.ID, cfg.webhookUrl, webhookSecret); err != nil {
			log.Warn("Failed to ensure notification config, continuing dispatch", "error", err)
		}
	}

	if !cfg.triggerRunOnChange {
		t.updateJobStatus(ctx, job.Id, oapi.JobStatusInProgress,
			"Workspace synced, waiting for VCS-triggered run", nil)
		return nil
	}

	_, err = createRun(ctx, client, targetWorkspace.ID, job.Id)
	if err != nil {
		t.updateJobStatus(ctx, job.Id, oapi.JobStatusFailure,
			fmt.Sprintf("failed to create run: %s", err.Error()), nil)
		return fmt.Errorf("failed to create run: %w", err)
	}

	t.updateJobStatus(ctx, job.Id, oapi.JobStatusInProgress,
		"Run created, webhook will track status", nil)
	return nil
}

func (t *TFE) updateJobStatus(ctx context.Context, jobID string, status oapi.JobStatus, message string, metadata map[string]string) {
	if err := t.setter.UpdateJob(ctx, jobID, status, message, metadata); err != nil {
		log.Error("Failed to update job status", "jobID", jobID, "error", err)
	}
}

// ensureNotificationConfig creates or updates a notification configuration
// on the TFC workspace to send run events to the ctrlplane webhook endpoint.
// It is idempotent — safe to call on every dispatch.
func ensureNotificationConfig(ctx context.Context, client *tfe.Client, workspaceID, webhookURL, webhookSecret string) error {
	configs, err := client.NotificationConfigurations.List(ctx, workspaceID, nil)
	if err != nil {
		return fmt.Errorf("failed to list notification configs: %w", err)
	}

	for _, cfg := range configs.Items {
		if cfg.Name != notificationConfigName {
			continue
		}
		if cfg.URL == webhookURL {
			return nil
		}
		_, err := client.NotificationConfigurations.Update(ctx, cfg.ID, tfe.NotificationConfigurationUpdateOptions{
			URL: &webhookURL,
		})
		if err != nil {
			return fmt.Errorf("failed to update notification config: %w", err)
		}
		return nil
	}

	enabled := true
	destType := tfe.NotificationDestinationTypeGeneric
	name := notificationConfigName
	opts := tfe.NotificationConfigurationCreateOptions{
		Name:            &name,
		DestinationType: &destType,
		Enabled:         &enabled,
		URL:             &webhookURL,
		Triggers: []tfe.NotificationTriggerType{
			tfe.NotificationTriggerCreated,
			tfe.NotificationTriggerPlanning,
			tfe.NotificationTriggerNeedsAttention,
			tfe.NotificationTriggerApplying,
			tfe.NotificationTriggerCompleted,
			tfe.NotificationTriggerErrored,
		},
	}
	if webhookSecret != "" {
		opts.Token = &webhookSecret
	}
	_, err = client.NotificationConfigurations.Create(ctx, workspaceID, opts)
	if err != nil {
		return fmt.Errorf("failed to create notification config: %w", err)
	}
	return nil
}

func parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (*tfeConfig, error) {
	address, ok := jobAgentConfig["address"].(string)
	if !ok {
		return nil, fmt.Errorf("address is required")
	}
	token, ok := jobAgentConfig["token"].(string)
	if !ok {
		return nil, fmt.Errorf("token is required")
	}
	organization, ok := jobAgentConfig["organization"].(string)
	if !ok {
		return nil, fmt.Errorf("organization is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok {
		return nil, fmt.Errorf("template is required")
	}
	if address == "" || token == "" || organization == "" || template == "" {
		return nil, fmt.Errorf("missing required fields in job agent config")
	}

	webhookUrl, _ := jobAgentConfig["webhookUrl"].(string)

	triggerRunOnChange := true
	if v, ok := jobAgentConfig["triggerRunOnChange"]; ok {
		switch val := v.(type) {
		case bool:
			triggerRunOnChange = val
		case string:
			triggerRunOnChange = val != "false"
		}
	}

	return &tfeConfig{
		address:            address,
		token:              token,
		organization:       organization,
		template:           template,
		webhookUrl:         webhookUrl,
		triggerRunOnChange: triggerRunOnChange,
	}, nil
}

func getClient(address, token string) (*tfe.Client, error) {
	client, err := tfe.NewClient(&tfe.Config{
		Address: address,
		Token:   token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Terraform Cloud client: %w", err)
	}
	return client, nil
}

// templateWorkspace renders the workspace YAML template using the dispatch context.
func templateWorkspace(dispatchCtx *oapi.DispatchContext, tmpl string) (*WorkspaceTemplate, error) {
	t, err := templatefuncs.Parse("terraformWorkspaceTemplate", tmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, dispatchCtx.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var workspace WorkspaceTemplate
	if err := yaml.Unmarshal(buf.Bytes(), &workspace); err != nil {
		return nil, fmt.Errorf("failed to unmarshal workspace: %w", err)
	}
	return &workspace, nil
}

func upsertWorkspace(ctx context.Context, client *tfe.Client, organization string, workspace *WorkspaceTemplate) (*tfe.Workspace, error) {
	existing, err := client.Workspaces.Read(ctx, organization, workspace.Name)
	if err != nil && !errors.Is(err, tfe.ErrResourceNotFound) {
		return nil, fmt.Errorf("failed to read workspace: %w", err)
	}

	if existing == nil {
		created, err := client.Workspaces.Create(ctx, organization, workspace.toCreateOptions())
		if err != nil {
			return nil, fmt.Errorf("failed to create workspace: %w", err)
		}
		return created, nil
	}

	updated, err := client.Workspaces.UpdateByID(ctx, existing.ID, workspace.toUpdateOptions())
	if err != nil {
		return nil, fmt.Errorf("failed to update workspace: %w", err)
	}
	return updated, nil
}

func syncVariables(ctx context.Context, client *tfe.Client, workspaceID string, desiredVars []VariableTemplate) error {
	existingVars, err := client.Variables.List(ctx, workspaceID, nil)
	if err != nil {
		return fmt.Errorf("failed to list variables: %w", err)
	}

	existingByKey := make(map[string]*tfe.Variable)
	for _, v := range existingVars.Items {
		existingByKey[v.Key] = v
	}

	for _, desired := range desiredVars {
		if _, err := desired.categoryType(); err != nil {
			return err
		}
		if existing, ok := existingByKey[desired.Key]; ok {
			_, err := client.Variables.Update(ctx, workspaceID, existing.ID, desired.toUpdateOptions())
			if err != nil {
				return fmt.Errorf("failed to update variable %s: %w", desired.Key, err)
			}
		} else {
			_, err := client.Variables.Create(ctx, workspaceID, desired.toCreateOptions())
			if err != nil {
				return fmt.Errorf("failed to create variable %s: %w", desired.Key, err)
			}
		}
	}

	return nil
}

func createRun(ctx context.Context, client *tfe.Client, workspaceID, jobID string) (*tfe.Run, error) {
	autoApply := true
	message := fmt.Sprintf("Triggered by ctrlplane job %s", jobID)
	run, err := client.Runs.Create(ctx, tfe.RunCreateOptions{
		Workspace: &tfe.Workspace{ID: workspaceID},
		Message:   &message,
		AutoApply: &autoApply,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create run: %w", err)
	}
	return run, nil
}

func (w *WorkspaceTemplate) toCreateOptions() tfe.WorkspaceCreateOptions {
	opts := tfe.WorkspaceCreateOptions{
		Name:                &w.Name,
		Description:         &w.Description,
		AutoApply:           &w.AutoApply,
		AllowDestroyPlan:    &w.AllowDestroyPlan,
		FileTriggersEnabled: &w.FileTriggersEnabled,
		GlobalRemoteState:   &w.GlobalRemoteState,
		QueueAllRuns:        &w.QueueAllRuns,
		SpeculativeEnabled:  &w.SpeculativeEnabled,
		TriggerPrefixes:     w.TriggerPrefixes,
		TriggerPatterns:     w.TriggerPatterns,
		WorkingDirectory:    &w.WorkingDirectory,
	}

	if w.Project != "" {
		opts.Project = &tfe.Project{ID: w.Project}
	}
	if w.ExecutionMode != "" {
		opts.ExecutionMode = &w.ExecutionMode
	}
	if w.TerraformVersion != "" {
		opts.TerraformVersion = &w.TerraformVersion
	}
	if w.AgentPoolID != "" {
		opts.AgentPoolID = &w.AgentPoolID
	}
	if w.VCSRepo != nil && w.VCSRepo.Identifier != "" {
		opts.VCSRepo = &tfe.VCSRepoOptions{
			Identifier:        &w.VCSRepo.Identifier,
			Branch:            &w.VCSRepo.Branch,
			OAuthTokenID:      &w.VCSRepo.OAuthTokenID,
			IngressSubmodules: &w.VCSRepo.IngressSubmodules,
			TagsRegex:         &w.VCSRepo.TagsRegex,
		}
	}

	return opts
}

func (w *WorkspaceTemplate) toUpdateOptions() tfe.WorkspaceUpdateOptions {
	opts := tfe.WorkspaceUpdateOptions{
		Name:                &w.Name,
		Description:         &w.Description,
		AutoApply:           &w.AutoApply,
		AllowDestroyPlan:    &w.AllowDestroyPlan,
		FileTriggersEnabled: &w.FileTriggersEnabled,
		GlobalRemoteState:   &w.GlobalRemoteState,
		QueueAllRuns:        &w.QueueAllRuns,
		SpeculativeEnabled:  &w.SpeculativeEnabled,
		TriggerPrefixes:     w.TriggerPrefixes,
		TriggerPatterns:     w.TriggerPatterns,
		WorkingDirectory:    &w.WorkingDirectory,
	}

	if w.ExecutionMode != "" {
		opts.ExecutionMode = &w.ExecutionMode
	}
	if w.TerraformVersion != "" {
		opts.TerraformVersion = &w.TerraformVersion
	}
	if w.AgentPoolID != "" {
		opts.AgentPoolID = &w.AgentPoolID
	}
	if w.VCSRepo != nil && w.VCSRepo.Identifier != "" {
		opts.VCSRepo = &tfe.VCSRepoOptions{
			Identifier:        &w.VCSRepo.Identifier,
			Branch:            &w.VCSRepo.Branch,
			OAuthTokenID:      &w.VCSRepo.OAuthTokenID,
			IngressSubmodules: &w.VCSRepo.IngressSubmodules,
			TagsRegex:         &w.VCSRepo.TagsRegex,
		}
	}

	return opts
}

var validCategories = map[string]tfe.CategoryType{
	"terraform": tfe.CategoryTerraform,
	"env":       tfe.CategoryEnv,
}

func (v *VariableTemplate) categoryType() (tfe.CategoryType, error) {
	if ct, ok := validCategories[v.Category]; ok {
		return ct, nil
	}
	return "", fmt.Errorf("invalid variable category %q for key %q (must be \"terraform\" or \"env\")", v.Category, v.Key)
}

func (v *VariableTemplate) toCreateOptions() tfe.VariableCreateOptions {
	category, _ := v.categoryType()
	return tfe.VariableCreateOptions{
		Key:         &v.Key,
		Value:       &v.Value,
		Description: &v.Description,
		Category:    &category,
		HCL:         &v.HCL,
		Sensitive:   &v.Sensitive,
	}
}

func (v *VariableTemplate) toUpdateOptions() tfe.VariableUpdateOptions {
	category, _ := v.categoryType()
	return tfe.VariableUpdateOptions{
		Key:         &v.Key,
		Value:       &v.Value,
		Description: &v.Description,
		Category:    &category,
		HCL:         &v.HCL,
		Sensitive:   &v.Sensitive,
	}
}
