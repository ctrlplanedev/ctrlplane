package types

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, context RenderContext) error
	Supports() Capabilities
}

type Capabilities struct {
	Workflows   bool
	Deployments bool
}

type RenderContext struct {
	Job            *oapi.Job               `json:"job"`
	JobAgent       *oapi.JobAgent          `json:"jobAgent"`
	JobAgentConfig *oapi.JobAgentConfig    `json:"-"`
	Release        *oapi.Release           `json:"release"`
	Deployment     *oapi.Deployment        `json:"deployment"`
	Environment    *oapi.Environment       `json:"environment"`
	Resource       *oapi.Resource          `json:"resource"`
	Workflow       *oapi.Workflow          `json:"workflow"`
	WorkflowStep   *oapi.WorkflowStep      `json:"step"`
	Version        *oapi.DeploymentVersion `json:"version"`
	Inputs         map[string]any          `json:"inputs"`
}

func (r *RenderContext) Map() map[string]any {
	result := make(map[string]any)
	if r.Job != nil {
		result["job"] = structToMap(r.Job)
	}
	if r.JobAgent != nil {
		result["jobAgent"] = structToMap(r.JobAgent)
	}
	if r.JobAgentConfig != nil {
		result["jobAgentConfig"] = structToMap(r.JobAgentConfig)
	}
	if r.Release != nil {
		result["release"] = structToMap(r.Release)
	}
	if r.Deployment != nil {
		result["deployment"] = structToMap(r.Deployment)
	}
	if r.Environment != nil {
		result["environment"] = structToMap(r.Environment)
	}
	if r.Resource != nil {
		result["resource"] = structToMap(r.Resource)
	}
	if r.Workflow != nil {
		result["workflow"] = structToMap(r.Workflow)
	}
	if r.WorkflowStep != nil {
		result["workflowStep"] = structToMap(r.WorkflowStep)
	}
	if r.Version != nil {
		result["version"] = structToMap(r.Version)
	}
	if r.Inputs != nil {
		result["inputs"] = r.Inputs
	}
	return result
}

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
