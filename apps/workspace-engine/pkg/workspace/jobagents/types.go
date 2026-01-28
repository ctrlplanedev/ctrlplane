package jobagents

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, context RenderContext) error
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
