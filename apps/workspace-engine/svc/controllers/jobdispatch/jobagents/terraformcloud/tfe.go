package terraformcloud

import (
	"context"
	"fmt"
	"os"

	"github.com/charmbracelet/log"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"
)

var _ types.Dispatchable = (*TFE)(nil)

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
		if err := ensureNotificationConfig(
			ctx,
			client,
			targetWorkspace.ID,
			cfg.webhookUrl,
			webhookSecret,
		); err != nil {
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

func (t *TFE) updateJobStatus(
	ctx context.Context,
	jobID string,
	status oapi.JobStatus,
	message string,
	metadata map[string]string,
) {
	if err := t.setter.UpdateJob(ctx, jobID, status, message, metadata); err != nil {
		log.Error("Failed to update job status", "jobID", jobID, "error", err)
	}
}
