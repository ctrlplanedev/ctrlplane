package github

import (
	"context"
	"fmt"

	"github.com/google/go-github/v66/github"
	gh "workspace-engine/pkg/github"
	"workspace-engine/pkg/oapi"
)

// GoGitHubWorkflowDispatcher is the production implementation that calls
// the GitHub API to dispatch workflows.
type GoGitHubWorkflowDispatcher struct{}

func (d *GoGitHubWorkflowDispatcher) DispatchWorkflow(
	ctx context.Context,
	cfg oapi.GithubJobAgentConfig,
	ref string,
	inputs map[string]any,
) error {
	client, err := gh.CreateClientForInstallation(ctx, int64(cfg.InstallationId))
	if err != nil {
		return fmt.Errorf("create github client: %w", err)
	}

	if _, err := client.Actions.CreateWorkflowDispatchEventByID(
		ctx,
		cfg.Owner,
		cfg.Repo,
		cfg.WorkflowId,
		github.CreateWorkflowDispatchEventRequest{
			Ref:    ref,
			Inputs: inputs,
		},
	); err != nil {
		return err
	}

	return nil
}
