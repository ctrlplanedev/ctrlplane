package github

import (
	"context"
	"fmt"

	gh "workspace-engine/pkg/github"
	"workspace-engine/pkg/oapi"
)

// ParseJobAgentConfig extracts and validates a GithubJobAgentConfig from
// raw config. Accepts either an explicit "owner" field or an
// "organizationId" field (resolved to the org login via the GitHub API).
func ParseJobAgentConfig(
	ctx context.Context,
	jobAgentConfig oapi.JobAgentConfig,
) (oapi.GithubJobAgentConfig, error) {
	installationId := toInt(jobAgentConfig["installationId"])
	if installationId == 0 {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("installationId is required")
	}

	owner, err := resolveOwner(ctx, jobAgentConfig, int64(installationId))
	if err != nil {
		return oapi.GithubJobAgentConfig{}, err
	}

	repo, ok := jobAgentConfig["repo"].(string)
	if !ok || repo == "" {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("repo is required")
	}

	workflowId := toInt64(jobAgentConfig["workflowId"])
	if workflowId == 0 {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("workflowId is required")
	}

	var ref *string
	if cfgRef, ok := jobAgentConfig["ref"].(string); ok && cfgRef != "" {
		ref = &cfgRef
	}

	return oapi.GithubJobAgentConfig{
		InstallationId: installationId,
		Owner:          owner,
		Repo:           repo,
		WorkflowId:     workflowId,
		Ref:            ref,
	}, nil
}

// resolveOwner returns the GitHub owner/org login from the config.
// If "owner" is present it is used directly; otherwise "organizationId"
// is resolved via the GitHub API using an installation-authenticated
// client (App JWT auth can't hit /organizations/{id}).
func resolveOwner(
	ctx context.Context,
	cfg oapi.JobAgentConfig,
	installationID int64,
) (string, error) {
	if owner, ok := cfg["owner"].(string); ok && owner != "" {
		return owner, nil
	}

	orgID := toInt64(cfg["organizationId"])
	if orgID == 0 {
		return "", fmt.Errorf("owner or organizationId is required")
	}

	client, err := gh.CreateClientForInstallation(ctx, installationID)
	if err != nil {
		return "", fmt.Errorf("create github installation client: %w", err)
	}

	org, _, err := client.Organizations.GetByID(ctx, orgID)
	if err != nil {
		return "", fmt.Errorf("lookup organization %d: %w", orgID, err)
	}

	login := org.GetLogin()
	if login == "" {
		return "", fmt.Errorf("organization %d has no login", orgID)
	}
	return login, nil
}

func toInt(v any) int {
	switch val := v.(type) {
	case int:
		return val
	case float64:
		return int(val)
	default:
		return 0
	}
}

func toInt64(v any) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	default:
		return 0
	}
}
