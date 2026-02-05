package oapi

import (
	"encoding/json"
	"fmt"
)

// String converts a LiteralValue to its string representation,
// handling strings, numbers, booleans, and other JSON types.
func (lv LiteralValue) String() string {
	var value any
	if err := json.Unmarshal(lv.union, &value); err != nil {
		return ""
	}
	return toString(value)
}

type TemplatableRelease struct {
	Release
	Variables map[string]string
}

func (r *Release) ToTemplatable() (*TemplatableRelease, error) {
	variables := make(map[string]string)
	for key, literalValue := range r.Variables {
		variables[key] = literalValue.String()
	}

	return &TemplatableRelease{
		Release:   *r,
		Variables: variables,
	}, nil
}

type TemplatableJob struct {
	JobWithRelease
	Release *TemplatableRelease
}

func (j *JobWithRelease) ToTemplatable() (*TemplatableJob,
	error) {
	release, err := j.Release.ToTemplatable()
	if err != nil {
		return nil, fmt.Errorf("failed to get templatable release: %w", err)
	}
	return &TemplatableJob{
		JobWithRelease: *j,
		Release:        release,
	}, nil
}

// Map converts the TemplatableJob to a map with lowercase keys for template use.
// This provides a consistent template interface using lowercase field names
// (e.g., {{.resource.name}} instead of {{.Resource.Name}}).
func (t *TemplatableJob) Map() map[string]any {
	result := make(map[string]any)

	// Convert each field to a map using JSON marshal/unmarshal
	// This ensures all keys are lowercase per JSON tags

	// Resource
	if t.Resource != nil {
		result["resource"] = structToMap(t.Resource)
	}

	// Deployment
	if t.Deployment != nil {
		result["deployment"] = structToMap(t.Deployment)
	}

	// Environment
	if t.Environment != nil {
		result["environment"] = structToMap(t.Environment)
	}

	// Job
	result["job"] = structToMap(t.Job)

	// Release with variables
	if t.Release != nil {
		releaseMap := structToMap(t.Release.Release)
		releaseMap["variables"] = t.Release.Variables
		result["release"] = releaseMap
	}

	return result
}

// structToMap converts a struct to a map using JSON marshal/unmarshal.
// This ensures all keys use the lowercase JSON tag names.
func structToMap(v any) map[string]any {
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}
	return result
}

func (j *Job) GetArgoCDJobAgentConfig() (*ArgoCDJobAgentConfig, error) {
	cfgJson, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job agent config: %w", err)
	}
	var cfg ArgoCDJobAgentConfig
	if err := json.Unmarshal(cfgJson, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}
	if cfg.ServerUrl == "" || cfg.ApiKey == "" || cfg.Template == "" {
		return nil, fmt.Errorf("missing required ArgoCD config fields")
	}
	return &cfg, nil
}

func (j *Job) GetArgoWorkflowsJobAgentConfig() (*ArgoWorkflowsJobAgentConfig, error) {
	cfgJson, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job agent config: %w", err)
	}
	var cfg ArgoWorkflowsJobAgentConfig
	if err := json.Unmarshal(cfgJson, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}
	if cfg.ServerUrl == "" || cfg.ApiKey == "" || cfg.Template == "" {
		return nil, fmt.Errorf("missing required Argo Workflows config fields")
	}
	return &cfg, nil
}

func (j *Job) GetGithubJobAgentConfig() (*GithubJobAgentConfig, error) {
	cfgJson, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job agent config: %w", err)
	}
	var cfg GithubJobAgentConfig
	if err := json.Unmarshal(cfgJson, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}
	if cfg.InstallationId == 0 || cfg.Owner == "" || cfg.Repo == "" || cfg.WorkflowId == 0 {
		return nil, fmt.Errorf("missing required GitHub config fields")
	}
	return &cfg, nil
}

func (j *Job) GetTerraformCloudJobAgentConfig() (*TerraformCloudJobAgentConfig, error) {
	cfgJson, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job agent config: %w", err)
	}
	var cfg TerraformCloudJobAgentConfig
	if err := json.Unmarshal(cfgJson, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}
	if cfg.Address == "" || cfg.Organization == "" || cfg.Token == "" || cfg.Template == "" {
		return nil, fmt.Errorf("missing required Terraform Cloud config fields")
	}
	return &cfg, nil
}

func (j *Job) GetTestRunnerJobAgentConfig() (*TestRunnerJobAgentConfig, error) {
	cfgJson, err := json.Marshal(j.JobAgentConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job agent config: %w", err)
	}
	var cfg TestRunnerJobAgentConfig
	if err := json.Unmarshal(cfgJson, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job agent config: %w", err)
	}
	return &cfg, nil
}
