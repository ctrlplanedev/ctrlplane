package types

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, context DispatchContext) error
	Supports() Capabilities
}

type Capabilities struct {
	Workflows   bool
	Deployments bool
}

type DispatchContext struct {
	Job            *oapi.Job               `json:"job"`
	JobAgent       *oapi.JobAgent          `json:"jobAgent"`
	JobAgentConfig oapi.JobAgentConfig     `json:"-"`
	Release        *oapi.Release           `json:"release"`
	Deployment     *oapi.Deployment        `json:"deployment"`
	Environment    *oapi.Environment       `json:"environment"`
	Resource       *oapi.Resource          `json:"resource"`
	Workflow       *oapi.Workflow          `json:"workflow"`
	WorkflowJob    *oapi.WorkflowJob       `json:"workflowJob"`
	Version        *oapi.DeploymentVersion `json:"version"`
	Inputs         map[string]any          `json:"inputs"`
	Matrix         map[string]interface{}  `json:"matrix"`
}

func (r *DispatchContext) Map() map[string]any {
	data, err := json.Marshal(r)
	if err != nil {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}

	return result
}
