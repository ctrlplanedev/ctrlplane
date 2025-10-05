package jobagents

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleJobAgentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &pb.JobAgent{}
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
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
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
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
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Remove(jobAgent.Id)

	return nil
}
