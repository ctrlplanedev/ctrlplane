package jobagents

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleJobAgentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &pb.JobAgent{}
	if err := protojson.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Upsert(jobAgent)

	return nil
}

func HandleJobAgentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &pb.JobAgent{}
	if err := protojson.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Upsert(jobAgent)

	return nil
}

func HandleJobAgentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &pb.JobAgent{}
	if err := protojson.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Remove(jobAgent.Id)

	return nil
}
