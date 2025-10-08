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
	job := &pb.Job{}
	if err := json.Unmarshal(event.Data, job); err != nil {
		return err
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
