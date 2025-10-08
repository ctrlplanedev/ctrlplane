package jobs

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleJobUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	job := &pb.Job{}
	if err := protojson.Unmarshal(event.Data, job); err != nil {
		return err
	}

	ws.Jobs().Upsert(ctx, job)

	rt := &pb.ReleaseTarget{
		EnvironmentId: job.EnvironmentId,
		DeploymentId:  job.DeploymentId,
		ResourceId:    job.ResourceId,
	}
	ws.ReleaseManager().TaintReleaseTargets(rt)

	return nil
}
