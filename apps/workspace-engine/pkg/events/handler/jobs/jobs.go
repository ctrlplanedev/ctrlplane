package jobs

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleJobUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	job := &pb.Job{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		if err := json.Unmarshal(currentData, job); err != nil {
			return err
		}
	} else {
		if err := json.Unmarshal(event.Data, job); err != nil {
			return err
		}
	}

	ws.Jobs().Upsert(ctx, job)
	
	rt := &pb.ReleaseTarget{
		EnvironmentId: job.EnvironmentId,
		DeploymentId: job.DeploymentId,
		ResourceId: job.ResourceId,
	}
	ws.ReleaseManager().TaintReleaseTargets(rt)

	return nil
}
