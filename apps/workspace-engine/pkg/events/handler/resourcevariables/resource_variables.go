package resourcevariables

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleResourceVariableCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &oapi.ResourceVariable{}
	if err := json.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Upsert(ctx, resourceVariable)

	releaseTargets, err := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

	return nil
}

func HandleResourceVariableUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &oapi.ResourceVariable{}
	if err := json.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Upsert(ctx, resourceVariable)

	releaseTargets, err := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

	return nil
}

func HandleResourceVariableDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariable := &oapi.ResourceVariable{}
	if err := json.Unmarshal(event.Data, resourceVariable); err != nil {
		return err
	}

	ws.ResourceVariables().Remove(ctx, resourceVariable.ResourceId, resourceVariable.Key)

	releaseTargets, err := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

	return nil
}
