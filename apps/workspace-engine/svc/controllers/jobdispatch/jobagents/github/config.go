package github

import (
	"fmt"

	"workspace-engine/pkg/oapi"
)

// ParseJobAgentConfig extracts and validates a GithubJobAgentConfig from raw config.
func ParseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (oapi.GithubJobAgentConfig, error) {
	installationId := toInt(jobAgentConfig["installationId"])
	if installationId == 0 {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("installationId is required")
	}

	owner, ok := jobAgentConfig["owner"].(string)
	if !ok || owner == "" {
		return oapi.GithubJobAgentConfig{}, fmt.Errorf("owner is required")
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
