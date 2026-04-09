package terraformcloud

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-tfe"
	"workspace-engine/pkg/oapi"
)

// GoWorkspaceSetup is the production implementation of WorkspaceSetup.
type GoWorkspaceSetup struct{}

func (g *GoWorkspaceSetup) Setup(ctx context.Context, dispatchCtx *oapi.DispatchContext) (string, error) {
	cfg, err := parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return "", err
	}

	client, err := getClient(cfg.address, cfg.token)
	if err != nil {
		return "", fmt.Errorf("create tfe client: %w", err)
	}

	workspace, err := templateWorkspace(dispatchCtx, cfg.template)
	if err != nil {
		return "", fmt.Errorf("template workspace: %w", err)
	}

	targetWorkspace, err := upsertWorkspace(ctx, client, cfg.organization, workspace)
	if err != nil {
		return "", fmt.Errorf("upsert workspace: %w", err)
	}

	if len(workspace.Variables) > 0 {
		if err := syncVariables(ctx, client, targetWorkspace.ID, workspace.Variables); err != nil {
			return "", fmt.Errorf("sync variables: %w", err)
		}
	}

	return targetWorkspace.ID, nil
}

// GoSpeculativeRunner is the production implementation of SpeculativeRunner.
type GoSpeculativeRunner struct{}

func (g *GoSpeculativeRunner) CreateSpeculativeRun(
	ctx context.Context,
	cfg *tfeConfig,
	workspaceID string,
) (string, error) {
	client, err := getClient(cfg.address, cfg.token)
	if err != nil {
		return "", fmt.Errorf("create tfe client: %w", err)
	}

	planOnly := true
	message := "Speculative plan by ctrlplane"
	run, err := client.Runs.Create(ctx, tfe.RunCreateOptions{
		Workspace: &tfe.Workspace{ID: workspaceID},
		PlanOnly:  &planOnly,
		Message:   &message,
	})
	if err != nil {
		return "", fmt.Errorf("create speculative run: %w", err)
	}
	return run.ID, nil
}

func (g *GoSpeculativeRunner) ReadRunStatus(
	ctx context.Context,
	cfg *tfeConfig,
	runID string,
) (*RunStatus, error) {
	client, err := getClient(cfg.address, cfg.token)
	if err != nil {
		return nil, fmt.Errorf("create tfe client: %w", err)
	}

	run, err := client.Runs.Read(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("read run: %w", err)
	}

	status := &RunStatus{
		Status: string(run.Status),
	}

	if run.Plan != nil {
		status.PlanID = run.Plan.ID
		status.ResourceAdditions = run.Plan.ResourceAdditions
		status.ResourceChanges = run.Plan.ResourceChanges
		status.ResourceDestructions = run.Plan.ResourceDestructions
	}

	switch run.Status {
	case tfe.RunPlannedAndFinished:
		status.IsFinished = true
	case tfe.RunErrored, tfe.RunCanceled, tfe.RunDiscarded:
		status.IsErrored = true
	}

	return status, nil
}

func (g *GoSpeculativeRunner) ReadPlanJSON(
	ctx context.Context,
	cfg *tfeConfig,
	planID string,
) ([]byte, error) {
	client, err := getClient(cfg.address, cfg.token)
	if err != nil {
		return nil, fmt.Errorf("create tfe client: %w", err)
	}

	data, err := client.Plans.ReadJSONOutput(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("read plan JSON output: %w", err)
	}
	return data, nil
}
