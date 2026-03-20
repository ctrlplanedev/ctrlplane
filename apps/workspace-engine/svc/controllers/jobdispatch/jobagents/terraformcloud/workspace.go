package terraformcloud

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"github.com/hashicorp/go-tfe"
	"sigs.k8s.io/yaml"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
)

type VCSRepoTemplate struct {
	Identifier        string `json:"identifier"                   yaml:"identifier"`
	Branch            string `json:"branch,omitempty"             yaml:"branch,omitempty"`
	OAuthTokenID      string `json:"oauth_token_id,omitempty"     yaml:"oauth_token_id,omitempty"`
	IngressSubmodules bool   `json:"ingress_submodules,omitempty" yaml:"ingress_submodules,omitempty"`
	TagsRegex         string `json:"tags_regex,omitempty"         yaml:"tags_regex,omitempty"`
}

type WorkspaceTemplate struct {
	Name                string             `json:"name"                            yaml:"name"`
	Description         string             `json:"description,omitempty"           yaml:"description,omitempty"`
	Project             string             `json:"project,omitempty"               yaml:"project,omitempty"`
	ExecutionMode       string             `json:"execution_mode,omitempty"        yaml:"execution_mode,omitempty"`
	AutoApply           bool               `json:"auto_apply,omitempty"            yaml:"auto_apply,omitempty"`
	AllowDestroyPlan    bool               `json:"allow_destroy_plan,omitempty"    yaml:"allow_destroy_plan,omitempty"`
	FileTriggersEnabled bool               `json:"file_triggers_enabled,omitempty" yaml:"file_triggers_enabled,omitempty"`
	GlobalRemoteState   bool               `json:"global_remote_state,omitempty"   yaml:"global_remote_state,omitempty"`
	QueueAllRuns        bool               `json:"queue_all_runs,omitempty"        yaml:"queue_all_runs,omitempty"`
	SpeculativeEnabled  bool               `json:"speculative_enabled,omitempty"   yaml:"speculative_enabled,omitempty"`
	TerraformVersion    string             `json:"terraform_version,omitempty"     yaml:"terraform_version,omitempty"`
	TriggerPrefixes     []string           `json:"trigger_prefixes,omitempty"      yaml:"trigger_prefixes,omitempty"`
	TriggerPatterns     []string           `json:"trigger_patterns,omitempty"      yaml:"trigger_patterns,omitempty"`
	WorkingDirectory    string             `json:"working_directory,omitempty"     yaml:"working_directory,omitempty"`
	AgentPoolID         string             `json:"agent_pool_id,omitempty"         yaml:"agent_pool_id,omitempty"`
	VCSRepo             *VCSRepoTemplate   `json:"vcs_repo,omitempty"              yaml:"vcs_repo,omitempty"`
	Variables           []VariableTemplate `json:"variables,omitempty"             yaml:"variables,omitempty"`
}

type VariableTemplate struct {
	Key         string `json:"key"                   yaml:"key"`
	Value       string `json:"value,omitempty"       yaml:"value,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	Category    string `json:"category"              yaml:"category"`
	HCL         bool   `json:"hcl,omitempty"         yaml:"hcl,omitempty"`
	Sensitive   bool   `json:"sensitive,omitempty"   yaml:"sensitive,omitempty"`
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

func upsertWorkspace(
	ctx context.Context,
	client *tfe.Client,
	organization string,
	workspace *WorkspaceTemplate,
) (*tfe.Workspace, error) {
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

func syncVariables(
	ctx context.Context,
	client *tfe.Client,
	workspaceID string,
	desiredVars []VariableTemplate,
) error {
	existingByKey := make(map[string]*tfe.Variable)
	listOpts := &tfe.VariableListOptions{}
	for {
		existingVars, err := client.Variables.List(ctx, workspaceID, listOpts)
		if err != nil {
			return fmt.Errorf("failed to list variables: %w", err)
		}
		for _, v := range existingVars.Items {
			existingByKey[v.Key] = v
		}
		if existingVars.Pagination == nil || existingVars.CurrentPage >= existingVars.TotalPages {
			break
		}
		listOpts.PageNumber = existingVars.NextPage
	}

	desiredKeys := make(map[string]bool, len(desiredVars))
	for _, desired := range desiredVars {
		desiredKeys[desired.Key] = true
		if _, err := desired.categoryType(); err != nil {
			return err
		}
		if existing, ok := existingByKey[desired.Key]; ok {
			_, err := client.Variables.Update(
				ctx,
				workspaceID,
				existing.ID,
				desired.toUpdateOptions(),
			)
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

	for key, existing := range existingByKey {
		if !desiredKeys[key] {
			if err := client.Variables.Delete(ctx, workspaceID, existing.ID); err != nil {
				return fmt.Errorf("failed to delete variable %s: %w", key, err)
			}
		}
	}

	return nil
}

func createRun(
	ctx context.Context,
	client *tfe.Client,
	workspaceID, jobID string,
) (*tfe.Run, error) {
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

// ensureNotificationConfig creates or updates a notification configuration
// on the TFC workspace to send run events to the ctrlplane webhook endpoint.
// It is idempotent — safe to call on every dispatch.
func ensureNotificationConfig(
	ctx context.Context,
	client *tfe.Client,
	workspaceID, webhookURL, webhookSecret string,
) error {
	configs, err := client.NotificationConfigurations.List(ctx, workspaceID, nil)
	if err != nil {
		return fmt.Errorf("failed to list notification configs: %w", err)
	}

	for _, cfg := range configs.Items {
		if cfg.Name != notificationConfigName {
			continue
		}
		// Always update: the token is write-only in the TFC API so we
		// cannot verify it matches.  Re-sending ensures secret rotation
		// is propagated without manual intervention.
		updateOpts := tfe.NotificationConfigurationUpdateOptions{
			URL: &webhookURL,
		}
		if webhookSecret != "" {
			updateOpts.Token = &webhookSecret
		}
		_, err := client.NotificationConfigurations.Update(
			ctx,
			cfg.ID,
			updateOpts,
		)
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
	return "", fmt.Errorf(
		"invalid variable category %q for key %q (must be \"terraform\" or \"env\")",
		v.Category,
		v.Key,
	)
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
