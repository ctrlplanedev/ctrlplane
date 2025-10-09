package resourcevariables

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleResourceVariableCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &pb.ResourceVariable{}
	if err := protojson.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Upsert(resourceVariable)
	ws.ReleaseManager().TaintResourcesReleaseTargets(resourceVariable.ResourceId)

	return nil
}

func HandleResourceVariableUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &pb.ResourceVariable{}
	if err := protojson.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Upsert(resourceVariable)
	ws.ReleaseManager().TaintResourcesReleaseTargets(resourceVariable.ResourceId)

	return nil
}

func HandleResourceVariableDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &pb.ResourceVariable{}
	if err := protojson.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Remove(resourceVariable.ResourceId, resourceVariable.Key)
	ws.ReleaseManager().TaintResourcesReleaseTargets(resourceVariable.ResourceId)

	return nil
}
