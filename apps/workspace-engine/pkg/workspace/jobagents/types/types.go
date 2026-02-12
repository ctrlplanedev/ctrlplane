package types

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type Dispatchable interface {
	Type() string
	Dispatch(ctx context.Context, job *oapi.Job) error
}

// type DispatchContext struct {
// 	Job            *oapi.Job               `json:"job"`
// 	JobAgent       *oapi.JobAgent          `json:"jobAgent"`
// 	JobAgentConfig oapi.JobAgentConfig     `json:"-"`
// 	Release        *oapi.Release           `json:"release"`
// 	Deployment     *oapi.Deployment        `json:"deployment"`
// 	Environment    *oapi.Environment       `json:"environment"`
// 	Resource       *oapi.Resource          `json:"resource"`
// 	WorkflowRun    *oapi.WorkflowRun       `json:"workflowRun"`
// 	WorkflowJob    *oapi.WorkflowJob       `json:"workflowJob"`
// 	Version        *oapi.DeploymentVersion `json:"version"`
// 	Inputs         map[string]any          `json:"inputs"`
// }

// func (r *DispatchContext) Map() map[string]any {
// 	data, err := json.Marshal(r)
// 	if err != nil {
// 		return nil
// 	}
// 	var result map[string]any
// 	if err := json.Unmarshal(data, &result); err != nil {
// 		return nil
// 	}

// 	return result
// }
