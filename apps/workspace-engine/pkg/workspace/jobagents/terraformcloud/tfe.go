package terraformcloud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strings"
	"time"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/hashicorp/go-tfe"
	"sigs.k8s.io/yaml"
)

var _ types.Dispatchable = &TFE{}

type TFE struct {
	store         *store.Store
	verifications *verification.Manager
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

func NewTFE(store *store.Store, verifications *verification.Manager) *TFE {
	return &TFE{store: store, verifications: verifications}
}

func (t *TFE) Type() string {
	return "tfe"
}

func (t *TFE) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   false,
		Deployments: true,
	}
}

func (t *TFE) Dispatch(ctx context.Context, dispatchCtx types.DispatchContext) error {
	address, token, organization, template, err := t.parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	workspace, err := t.getTemplatedWorkspace(dispatchCtx.Job, template)
	if err != nil {
		return fmt.Errorf("failed to generate workspace from template: %w", err)
	}

	go func() {
		ctx := context.WithoutCancel(ctx)
		client, err := t.getClient(address, token)
		if err != nil {
			t.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to create Terraform Cloud client: %s", err.Error()))
			return
		}

		targetWorkspace, err := t.upsertWorkspace(ctx, client, organization, workspace)
		if err != nil {
			t.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to upsert workspace: %s", err.Error()))
			return
		}

		if len(workspace.Variables) > 0 {
			if err := t.syncVariables(ctx, client, targetWorkspace.ID, workspace.Variables); err != nil {
				t.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to sync variables: %s", err.Error()))
				return
			}
		}

		run, err := t.createRun(ctx, client, targetWorkspace.ID, dispatchCtx.Job.Id)
		if err != nil {
			t.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to create run: %s", err.Error()))
			return
		}

		verification := newTFERunVerification(t.verifications, dispatchCtx.Job, address, token, run.ID)
		if err := verification.StartVerification(ctx); err != nil {
			t.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to start verification: %s", err.Error()))
			return
		}

		t.sendJobUpdateEvent(address, organization, targetWorkspace.Name, run, dispatchCtx)
	}()

	return nil
}

func (t *TFE) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (string, string, string, string, error) {
	address, ok := jobAgentConfig["address"].(string)
	if !ok {
		return "", "", "", "", fmt.Errorf("address is required")
	}
	token, ok := jobAgentConfig["token"].(string)
	if !ok {
		return "", "", "", "", fmt.Errorf("token is required")
	}
	organization, ok := jobAgentConfig["organization"].(string)
	if !ok {
		return "", "", "", "", fmt.Errorf("organization is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok {
		return "", "", "", "", fmt.Errorf("template is required")
	}
	if address == "" || token == "" || organization == "" || template == "" {
		return "", "", "", "", fmt.Errorf("missing required fields in job agent config")
	}
	return address, token, organization, template, nil
}

func (t *TFE) getClient(address, token string) (*tfe.Client, error) {
	client, err := tfe.NewClient(&tfe.Config{
		Address: address,
		Token:   token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Terraform Cloud client: %w", err)
	}
	return client, nil
}

func (t *TFE) getTemplatableJob(job *oapi.Job) (*oapi.TemplatableJob, error) {
	fullJob, err := t.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		return nil, err
	}
	return fullJob.ToTemplatable()
}

func (t *TFE) getTemplatedWorkspace(job *oapi.Job, template string) (*WorkspaceTemplate, error) {
	templatableJob, err := t.getTemplatableJob(job)
	if err != nil {
		return nil, fmt.Errorf("failed to get templatable job: %w", err)
	}
	tmpl, err := templatefuncs.Parse("terraformWorkspaceTemplate", template)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, templatableJob.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var workspace WorkspaceTemplate
	if err := yaml.Unmarshal(buf.Bytes(), &workspace); err != nil {
		return nil, fmt.Errorf("failed to unmarshal workspace: %w", err)
	}
	return &workspace, nil
}

func (t *TFE) upsertWorkspace(ctx context.Context, client *tfe.Client, organization string, workspace *WorkspaceTemplate) (*tfe.Workspace, error) {
	existing, err := client.Workspaces.Read(ctx, organization, workspace.Name)
	if err != nil && err.Error() != "resource not found" {
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

func (t *TFE) syncVariables(ctx context.Context, client *tfe.Client, workspaceID string, desiredVars []VariableTemplate) error {
	existingVars, err := client.Variables.List(ctx, workspaceID, nil)
	if err != nil {
		return fmt.Errorf("failed to list variables: %w", err)
	}

	existingByKey := make(map[string]*tfe.Variable)
	for _, v := range existingVars.Items {
		existingByKey[v.Key] = v
	}

	for _, desired := range desiredVars {
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

func (t *TFE) createRun(ctx context.Context, client *tfe.Client, workspaceID, jobID string) (*tfe.Run, error) {
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

func (t *TFE) sendJobFailureEvent(context types.DispatchContext, message string) error {
	workspaceId := t.store.ID()

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &context.Job.Id,
		Job: oapi.Job{
			Id:          context.Job.Id,
			Status:      oapi.JobStatusFailure,
			Message:     &message,
			UpdatedAt:   now,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateMessage,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
			oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
		},
	}
	producer, err := t.getKafkaProducer()
	if err != nil {
		return fmt.Errorf("failed to create Kafka producer: %w", err)
	}
	defer producer.Close()

	event := map[string]any{
		"eventType":   "job.updated",
		"workspaceId": workspaceId,
		"data":        eventPayload,
		"timestamp":   time.Now().Unix(),
	}
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}
	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	return nil
}

func (t *TFE) sendJobUpdateEvent(address, organization, workspaceName string, run *tfe.Run, context types.DispatchContext) error {
	workspaceId := t.store.ID()

	runUrl := fmt.Sprintf("%s/app/%s/workspaces/%s/runs/%s", address, organization, workspaceName, run.ID)
	if !strings.HasPrefix(runUrl, "https://") {
		runUrl = "https://" + runUrl
	}

	workspaceUrl := fmt.Sprintf("%s/app/%s/workspaces/%s", address, organization, workspaceName)
	if !strings.HasPrefix(workspaceUrl, "https://") {
		workspaceUrl = "https://" + workspaceUrl
	}

	links := make(map[string]string)
	links["TFE Run"] = runUrl
	links["TFE Workspace"] = workspaceUrl
	linksJSON, err := json.Marshal(links)
	if err != nil {
		return fmt.Errorf("failed to marshal links: %w", err)
	}

	newJobMetadata := make(map[string]string)
	maps.Copy(newJobMetadata, context.Job.Metadata)
	newJobMetadata[string("ctrlplane/links")] = string(linksJSON)

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &context.Job.Id,
		Job: oapi.Job{
			Id:          context.Job.Id,
			Metadata:    newJobMetadata,
			Status:      oapi.JobStatusSuccessful,
			UpdatedAt:   now,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateMetadata,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
			oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
		},
	}
	producer, err := t.getKafkaProducer()
	if err != nil {
		return fmt.Errorf("failed to create Kafka producer: %w", err)
	}
	defer producer.Close()

	event := map[string]any{
		"eventType":   "job.updated",
		"workspaceId": workspaceId,
		"data":        eventPayload,
		"timestamp":   time.Now().Unix(),
	}
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}
	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	return nil
}

func (t *TFE) getKafkaProducer() (messaging.Producer, error) {
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
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

func (v *VariableTemplate) toCreateOptions() tfe.VariableCreateOptions {
	category := tfe.CategoryType(v.Category)
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
	category := tfe.CategoryType(v.Category)
	return tfe.VariableUpdateOptions{
		Key:         &v.Key,
		Value:       &v.Value,
		Description: &v.Description,
		Category:    &category,
		HCL:         &v.HCL,
		Sensitive:   &v.Sensitive,
	}
}
