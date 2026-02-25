package terraformcloud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strings"
	"time"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/hashicorp/go-tfe"
	"sigs.k8s.io/yaml"
)

var _ types.Dispatchable = &TFE{}
var _ types.Restorable = &TFE{}

type TFE struct {
	store *store.Store
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

func NewTFE(store *store.Store) *TFE {
	return &TFE{store: store}
}

func (t *TFE) Type() string {
	return "tfe"
}

func (t *TFE) Dispatch(ctx context.Context, job *oapi.Job) error {
	dispatchCtx := job.DispatchContext
	address, token, organization, template, err := t.parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	workspace, err := t.getTemplatedWorkspace(job, template)
	if err != nil {
		return fmt.Errorf("failed to generate workspace from template: %w", err)
	}

	go func() {
		ctx := context.WithoutCancel(ctx)
		client, err := t.getClient(address, token)
		if err != nil {
			t.sendJobEvent(job, oapi.JobStatusFailure, fmt.Sprintf("failed to create Terraform Cloud client: %s", err.Error()), nil, address, organization, "")
			return
		}

		targetWorkspace, err := t.upsertWorkspace(ctx, client, organization, workspace)
		if err != nil {
			t.sendJobEvent(job, oapi.JobStatusFailure, fmt.Sprintf("failed to upsert workspace: %s", err.Error()), nil, address, organization, "")
			return
		}

		if len(workspace.Variables) > 0 {
			if err := t.syncVariables(ctx, client, targetWorkspace.ID, workspace.Variables); err != nil {
				t.sendJobEvent(job, oapi.JobStatusFailure, fmt.Sprintf("failed to sync variables: %s", err.Error()), nil, address, organization, targetWorkspace.Name)
				return
			}
		}

		run, err := t.createRun(ctx, client, targetWorkspace.ID, job.Id)
		if err != nil {
			t.sendJobEvent(job, oapi.JobStatusFailure, fmt.Sprintf("failed to create run: %s", err.Error()), nil, address, organization, targetWorkspace.Name)
			return
		}

		t.sendJobEvent(job, oapi.JobStatusInProgress, "Run created, polling status...", run, address, organization, targetWorkspace.Name)
		t.pollRunStatus(ctx, client, run.ID, job, address, organization, targetWorkspace.Name)
	}()

	return nil
}

// RestoreJobs resumes polling for in-flight TFC runs after an engine restart.
// Jobs with an ExternalId (the TFC run ID) are resumed; jobs without one are
// marked as externalRunNotFound.
func (t *TFE) RestoreJobs(ctx context.Context, jobs []*oapi.Job) error {
	for _, job := range jobs {
		if job.ExternalId == nil || *job.ExternalId == "" {
			msg := "Run ID not recorded before engine restart"
			t.sendJobEvent(job, oapi.JobStatusExternalRunNotFound, msg, nil, "", "", "")
			continue
		}

		address, token, organization, _, err := t.parseJobAgentConfig(job.DispatchContext.JobAgentConfig)
		if err != nil {
			msg := fmt.Sprintf("Failed to parse job agent config on restore: %s", err.Error())
			t.sendJobEvent(job, oapi.JobStatusFailure, msg, nil, "", "", "")
			continue
		}

		client, err := t.getClient(address, token)
		if err != nil {
			msg := fmt.Sprintf("Failed to create TFE client on restore: %s", err.Error())
			t.sendJobEvent(job, oapi.JobStatusFailure, msg, nil, address, organization, "")
			continue
		}

		runID := *job.ExternalId
		log.Info("Restoring TFC run polling", "jobId", job.Id, "runId", runID)
		go t.pollRunStatus(ctx, client, runID, job, address, organization, "")
	}
	return nil
}

func (t *TFE) pollRunStatus(ctx context.Context, client *tfe.Client, runID string, job *oapi.Job, address, organization, wsName string) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	var lastStatus tfe.RunStatus
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run, err := client.Runs.ReadWithOptions(ctx, runID, &tfe.RunReadOptions{
				Include: []tfe.RunIncludeOpt{tfe.RunPlan},
			})
			if err != nil {
				log.Error("Failed to poll TFC run status", "runId", runID, "error", err)
				continue
			}
			if run.Status == lastStatus {
				continue
			}
			lastStatus = run.Status

			jobStatus, message := mapRunStatus(run)
			if err := t.sendJobEvent(job, jobStatus, message, run, address, organization, wsName); err != nil {
				log.Error("Failed to send job event", "runId", runID, "error", err)
			}

			if isTerminalJobStatus(jobStatus) {
				return
			}
		}
	}
}

func isTerminalJobStatus(status oapi.JobStatus) bool {
	switch status {
	case oapi.JobStatusSuccessful, oapi.JobStatusFailure, oapi.JobStatusCancelled, oapi.JobStatusExternalRunNotFound:
		return true
	default:
		return false
	}
}

func mapRunStatus(run *tfe.Run) (oapi.JobStatus, string) {
	changes := formatResourceChanges(run)

	switch run.Status {
	case tfe.RunPending:
		pos := run.PositionInQueue
		return oapi.JobStatusPending, fmt.Sprintf("Run pending in queue (position: %d)", pos)

	case tfe.RunFetching, tfe.RunFetchingCompleted:
		return oapi.JobStatusInProgress, "Fetching configuration..."

	case tfe.RunPrePlanRunning, tfe.RunPrePlanCompleted:
		return oapi.JobStatusInProgress, "Running pre-plan tasks..."

	case tfe.RunQueuing, tfe.RunPlanQueued:
		return oapi.JobStatusInProgress, "Queued for planning..."

	case tfe.RunPlanning:
		return oapi.JobStatusInProgress, "Planning..."

	case tfe.RunPlanned:
		if run.Actions != nil && run.Actions.IsConfirmable {
			return oapi.JobStatusActionRequired, fmt.Sprintf("Plan complete — awaiting approval. %s", changes)
		}
		return oapi.JobStatusInProgress, "Plan complete, auto-applying..."

	case tfe.RunPlannedAndFinished:
		return oapi.JobStatusSuccessful, fmt.Sprintf("Plan complete (no changes). %s", changes)

	case tfe.RunPlannedAndSaved:
		return oapi.JobStatusSuccessful, fmt.Sprintf("Plan saved. %s", changes)

	case tfe.RunCostEstimating, tfe.RunCostEstimated:
		return oapi.JobStatusInProgress, "Estimating costs..."

	case tfe.RunPolicyChecking, tfe.RunPolicyChecked:
		return oapi.JobStatusInProgress, "Checking policies..."

	case tfe.RunPolicyOverride:
		return oapi.JobStatusActionRequired, "Policy check failed — awaiting override"

	case tfe.RunPolicySoftFailed:
		return oapi.JobStatusActionRequired, "Policy soft-failed — awaiting override"

	case tfe.RunPostPlanRunning, tfe.RunPostPlanCompleted, tfe.RunPostPlanAwaitingDecision:
		return oapi.JobStatusInProgress, "Running post-plan tasks..."

	case tfe.RunConfirmed:
		return oapi.JobStatusInProgress, "Confirmed, queuing apply..."

	case tfe.RunApplyQueued, tfe.RunQueuingApply:
		return oapi.JobStatusInProgress, "Queued for apply..."

	case tfe.RunApplying:
		return oapi.JobStatusInProgress, "Applying..."

	case tfe.RunApplied:
		return oapi.JobStatusSuccessful, fmt.Sprintf("Applied successfully. %s", changes)

	case tfe.RunPreApplyRunning, tfe.RunPreApplyCompleted:
		return oapi.JobStatusInProgress, "Running pre-apply tasks..."

	case tfe.RunErrored:
		return oapi.JobStatusFailure, fmt.Sprintf("Run errored: %s", run.Message)

	case tfe.RunCanceled:
		return oapi.JobStatusCancelled, "Run was canceled"

	case tfe.RunDiscarded:
		return oapi.JobStatusCancelled, "Run was discarded"

	default:
		return oapi.JobStatusInProgress, fmt.Sprintf("Run status: %s", run.Status)
	}
}

func formatResourceChanges(run *tfe.Run) string {
	if run.Plan == nil {
		return "+0/~0/-0"
	}
	return fmt.Sprintf("+%d/~%d/-%d",
		run.Plan.ResourceAdditions,
		run.Plan.ResourceChanges,
		run.Plan.ResourceDestructions,
	)
}

func (t *TFE) sendJobEvent(job *oapi.Job, status oapi.JobStatus, message string, run *tfe.Run, address, organization, wsName string) error {
	workspaceId := t.store.ID()
	now := time.Now().UTC()

	fields := []oapi.JobUpdateEventFieldsToUpdate{
		oapi.JobUpdateEventFieldsToUpdateStatus,
		oapi.JobUpdateEventFieldsToUpdateMessage,
		oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
	}

	eventJob := oapi.Job{
		Id:        job.Id,
		Status:    status,
		Message:   &message,
		UpdatedAt: now,
	}

	// Set externalId from the run
	if run != nil {
		eventJob.ExternalId = &run.ID
		fields = append(fields, oapi.JobUpdateEventFieldsToUpdateExternalId)
	}

	// Set metadata with links when we have enough info
	if run != nil && address != "" && organization != "" && wsName != "" {
		runUrl := fmt.Sprintf("%s/app/%s/workspaces/%s/runs/%s", address, organization, wsName, run.ID)
		if !strings.HasPrefix(runUrl, "https://") {
			runUrl = "https://" + runUrl
		}
		workspaceUrl := fmt.Sprintf("%s/app/%s/workspaces/%s", address, organization, wsName)
		if !strings.HasPrefix(workspaceUrl, "https://") {
			workspaceUrl = "https://" + workspaceUrl
		}

		links := map[string]string{
			"TFE Run":       runUrl,
			"TFE Workspace": workspaceUrl,
		}
		linksJSON, err := json.Marshal(links)
		if err == nil {
			newJobMetadata := make(map[string]string)
			maps.Copy(newJobMetadata, job.Metadata)
			newJobMetadata["ctrlplane/links"] = string(linksJSON)
			eventJob.Metadata = newJobMetadata
			fields = append(fields, oapi.JobUpdateEventFieldsToUpdateMetadata)
		}
	}

	if isTerminalJobStatus(status) {
		eventJob.CompletedAt = &now
		fields = append(fields, oapi.JobUpdateEventFieldsToUpdateCompletedAt)
	}

	// Set startedAt for first non-pending transition
	if status == oapi.JobStatusInProgress {
		eventJob.StartedAt = &now
		fields = append(fields, oapi.JobUpdateEventFieldsToUpdateStartedAt)
	}

	eventPayload := oapi.JobUpdateEvent{
		Id:             &job.Id,
		Job:            eventJob,
		FieldsToUpdate: &fields,
	}

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
	if err := messaging.Publish([]byte(workspaceId), eventBytes); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
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
