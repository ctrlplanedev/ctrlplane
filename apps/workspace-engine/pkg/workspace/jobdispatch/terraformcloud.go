package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"text/template"

	"github.com/Masterminds/sprig/v3"
	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/hashicorp/go-tfe"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"sigs.k8s.io/yaml"
)

var terraformTracer = otel.Tracer("TerraformDispatcher")

type TerraformCloudDispatcher struct {
	store        *store.Store
	verification *verification.Manager
}

type terraformCloudAgentConfig struct {
	Organization string `json:"organization"`
	Address      string `json:"address"`
	Token        string `json:"token"`
	Template     string `json:"template"`
}

// VCSRepoTemplate represents VCS repository settings for a workspace
type VCSRepoTemplate struct {
	Identifier        string `json:"identifier" yaml:"identifier"`                                     // e.g., "org/repo"
	Branch            string `json:"branch,omitempty" yaml:"branch,omitempty"`                         // e.g., "main"
	OAuthTokenID      string `json:"oauth_token_id,omitempty" yaml:"oauth_token_id,omitempty"`         // e.g., "ot-xxxxxxxxxx"
	IngressSubmodules bool   `json:"ingress_submodules,omitempty" yaml:"ingress_submodules,omitempty"` // Include submodules
	TagsRegex         string `json:"tags_regex,omitempty" yaml:"tags_regex,omitempty"`                 // For tag-based triggers
}

// WorkspaceTemplate is a custom struct for parsing workspace templates from JSON/YAML
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

// VariableTemplate represents a workspace variable in templates
type VariableTemplate struct {
	Key         string `json:"key" yaml:"key"`
	Value       string `json:"value,omitempty" yaml:"value,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	Category    string `json:"category" yaml:"category"` // "terraform" or "env"
	HCL         bool   `json:"hcl,omitempty" yaml:"hcl,omitempty"`
	Sensitive   bool   `json:"sensitive,omitempty" yaml:"sensitive,omitempty"`
}

func unmarshalWorkspaceTemplate(data []byte, ws *WorkspaceTemplate) error {
	// Try YAML first (YAML is a superset of JSON, so this handles both)
	if err := yaml.Unmarshal(data, ws); err != nil {
		return fmt.Errorf("failed to parse workspace template: %w", err)
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

func NewTerraformCloudDispatcher(store *store.Store, verification *verification.Manager) *TerraformCloudDispatcher {
	return &TerraformCloudDispatcher{store: store, verification: verification}
}

func (d *TerraformCloudDispatcher) parseConfig(job *oapi.Job) (terraformCloudAgentConfig, error) {
	var parsed terraformCloudAgentConfig
	rawCfg, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return terraformCloudAgentConfig{}, err
	}

	if err := json.Unmarshal(rawCfg, &parsed); err != nil {
		return terraformCloudAgentConfig{}, err
	}

	if parsed.Address == "" {
		return terraformCloudAgentConfig{}, fmt.Errorf("missing required Terraform job config: address")
	}
	if parsed.Token == "" {
		return terraformCloudAgentConfig{}, fmt.Errorf("missing required Terraform job config: token")
	}
	if parsed.Template == "" {
		return terraformCloudAgentConfig{}, fmt.Errorf("missing required Terraform job config: template")
	}
	return parsed, nil
}

func (d *TerraformCloudDispatcher) getTemplatableJob(job *oapi.Job) (*oapi.TemplatableJob, error) {
	fullJob, err := d.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		return nil, err
	}
	return fullJob.ToTemplatable()
}

func (d *TerraformCloudDispatcher) generateWorkspace(job *oapi.TemplatableJob, tfTemplate string) (*WorkspaceTemplate, error) {
	t, err := template.New("terraformWorkspaceTemplate").Funcs(sprig.TxtFuncMap()).Option("missingkey=zero").Parse(tfTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, job); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var workspace WorkspaceTemplate
	if err := unmarshalWorkspaceTemplate(buf.Bytes(), &workspace); err != nil {
		return nil, fmt.Errorf("failed to unmarshal workspace: %w", err)
	}

	return &workspace, nil
}

func (d *TerraformCloudDispatcher) getExistingWorkspace(ctx context.Context, client *tfe.Client, organization string, workspaceName string) (*tfe.Workspace, error) {
	ws, err := client.Workspaces.Read(ctx, organization, workspaceName)
	if err != nil {
		if err.Error() == "resource not found" {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read workspace: %w", err)
	}
	return ws, nil
}

func (d *TerraformCloudDispatcher) createWorkspace(ctx context.Context, client *tfe.Client, organization string, workspace *WorkspaceTemplate) (*tfe.Workspace, error) {
	created, err := client.Workspaces.Create(ctx, organization, workspace.toCreateOptions())
	if err != nil {
		return nil, fmt.Errorf("failed to create workspace: %w", err)
	}
	return created, nil
}

func (d *TerraformCloudDispatcher) updateWorkspace(ctx context.Context, client *tfe.Client, existing *tfe.Workspace, workspace *WorkspaceTemplate) (*tfe.Workspace, error) {
	updated, err := client.Workspaces.UpdateByID(ctx, existing.ID, workspace.toUpdateOptions())
	if err != nil {
		return nil, fmt.Errorf("failed to update workspace: %w", err)
	}
	return updated, nil
}

func (d *TerraformCloudDispatcher) syncVariables(ctx context.Context, client *tfe.Client, workspaceID string, desiredVars []VariableTemplate) error {
	// Get existing variables
	existingVars, err := client.Variables.List(ctx, workspaceID, nil)
	if err != nil {
		return fmt.Errorf("failed to list variables: %w", err)
	}

	// Build map of existing variables by key
	existingByKey := make(map[string]*tfe.Variable)
	for _, v := range existingVars.Items {
		existingByKey[v.Key] = v
	}

	// Create or update variables
	for _, desired := range desiredVars {
		if existing, ok := existingByKey[desired.Key]; ok {
			// Update existing variable
			_, err := client.Variables.Update(ctx, workspaceID, existing.ID, desired.toUpdateOptions())
			if err != nil {
				return fmt.Errorf("failed to update variable %s: %w", desired.Key, err)
			}
		} else {
			// Create new variable
			_, err := client.Variables.Create(ctx, workspaceID, desired.toCreateOptions())
			if err != nil {
				return fmt.Errorf("failed to create variable %s: %w", desired.Key, err)
			}
		}
	}

	return nil
}

func (d *TerraformCloudDispatcher) createRunVerification(ctx context.Context, release *oapi.Release, config terraformCloudAgentConfig, runId string) error {
	provider := oapi.MetricProvider{}
	err := provider.FromTerraformCloudRunMetricProvider(oapi.TerraformCloudRunMetricProvider{
		Address: config.Address,
		Token:   config.Token,
		RunId:   runId,
	})
	if err != nil {
		return fmt.Errorf("failed to create Terraform Cloud run metric provider: %w", err)
	}

	metrics := []oapi.VerificationMetricSpec{
		{
			Count:            100,
			IntervalSeconds:  60,
			SuccessCondition: "result.status == 'applied' || result.status == 'planned_and_finished' || result.status == 'planned_and_saved'",
			FailureCondition: &[]string{"result.status == 'canceled' || result.status == 'discarded' || result.status == 'errored'"}[0],
			SuccessThreshold: &[]int{1}[0],
			FailureThreshold: &[]int{1}[0],
			Provider:         provider,
		},
	}

	return d.verification.StartVerification(ctx, release, metrics)
}

func (d *TerraformCloudDispatcher) getKafkaProducer() (messaging.Producer, error) {
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
}

func (d *TerraformCloudDispatcher) sendJobUpdateEvent(job *oapi.Job, run *tfe.Run, config terraformCloudAgentConfig, workspaceName string) error {
	_, span := terraformTracer.Start(context.Background(), "sendJobUpdateEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("run.id", run.ID),
	)

	workspaceId := d.store.ID()

	runUrl := fmt.Sprintf("%s/app/%s/workspaces/%s/runs/%s", config.Address, config.Organization, workspaceName, run.ID)
	if !strings.HasPrefix(runUrl, "https://") {
		runUrl = "https://" + runUrl
	}

	workspaceUrl := fmt.Sprintf("%s/app/%s/workspaces/%s", config.Address, config.Organization, workspaceName)
	if !strings.HasPrefix(workspaceUrl, "https://") {
		workspaceUrl = "https://" + workspaceUrl
	}

	links := make(map[string]string)
	links["TFE Run"] = runUrl
	links["TFE Workspace"] = workspaceUrl
	linksJSON, err := json.Marshal(links)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal links")
		return fmt.Errorf("failed to marshal links: %w", err)
	}

	now := time.Now().UTC()
	jobWithUpdates := oapi.Job{
		Id: job.Id,
		Metadata: map[string]string{
			string("ctrlplane/links"): string(linksJSON),
		},
		Status:      oapi.JobStatusSuccessful,
		UpdatedAt:   now,
		CompletedAt: &now,
	}

	eventPayload := oapi.JobUpdateEvent{
		Id:             &job.Id,
		Job:            jobWithUpdates,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.Status, oapi.Metadata, oapi.CompletedAt, oapi.UpdatedAt},
	}

	producer, err := d.getKafkaProducer()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create Kafka producer")
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
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal event")
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to publish event")
		return err
	}
	return nil
}

func (d *TerraformCloudDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	ctx, span := terraformTracer.Start(ctx, "TerraformDispatcher.DispatchJob")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", job.Id))

	cfg, err := d.parseConfig(job)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		return err
	}

	templatableJob, err := d.getTemplatableJob(job)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get templatable job")
		return err
	}

	workspace, err := d.generateWorkspace(templatableJob, cfg.Template)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to generate workspace")
		return err
	}

	client, err := tfe.NewClient(&tfe.Config{
		Address: cfg.Address,
		Token:   cfg.Token,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create Terraform client")
		return err
	}

	existingWorkspace, err := d.getExistingWorkspace(ctx, client, cfg.Organization, workspace.Name)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get existing workspace")
		return err
	}

	var targetWorkspace *tfe.Workspace
	if existingWorkspace == nil {
		targetWorkspace, err = d.createWorkspace(ctx, client, cfg.Organization, workspace)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to create workspace")
			return err
		}
		span.SetAttributes(attribute.Bool("workspace_created", true))
	}

	if existingWorkspace != nil {
		targetWorkspace, err = d.updateWorkspace(ctx, client, existingWorkspace, workspace)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to update workspace")
			return err
		}
		span.SetAttributes(attribute.Bool("workspace_updated", true))
	}

	if len(workspace.Variables) > 0 {
		if err := d.syncVariables(ctx, client, targetWorkspace.ID, workspace.Variables); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to sync variables")
			return err
		}
	}

	if workspace.VCSRepo != nil && workspace.VCSRepo.Identifier != "" {
		span.SetAttributes(attribute.Bool("vcs_connected", true))
	}

	autoApply := true
	message := fmt.Sprintf("Triggered by ctrlplane job %s", job.Id)
	run, err := client.Runs.Create(ctx, tfe.RunCreateOptions{
		Workspace: &tfe.Workspace{ID: targetWorkspace.ID},
		Message:   &message,
		AutoApply: &autoApply,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create run")
		return err
	}

	if err := d.createRunVerification(ctx, &templatableJob.Release.Release, cfg, run.ID); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create run verification")
		return err
	}

	if err := d.sendJobUpdateEvent(job, run, cfg, targetWorkspace.Name); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to send job update event")
		return err
	}

	return nil
}
