package jobs

import (
	"context"
	"encoding/json"
	"errors"
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
		var payload struct {
			New *pb.Job `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' job in update event")
		}
		job = payload.New
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
