package resourcevariables

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
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

	releaseTargets := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.ResourceId == resourceVariable.ResourceId {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	for _, rt := range reconileReleaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))

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

	releaseTargets := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.ResourceId == resourceVariable.ResourceId {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	for _, rt := range reconileReleaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))

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

	releaseTargets := ws.ReleaseTargets().GetForResource(ctx, resourceVariable.ResourceId)
	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.ResourceId == resourceVariable.ResourceId {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	for _, rt := range reconileReleaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))

	return nil
}

func HandleResourceVariablesBulkUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceVariablesBulkUpdateEvent := &oapi.ResourceVariablesBulkUpdateEvent{}
	if err := json.Unmarshal(event.Data, resourceVariablesBulkUpdateEvent); err != nil {
		return err
	}

	hasChanges, err := ws.ResourceVariables().BulkUpdate(ctx, resourceVariablesBulkUpdateEvent.ResourceId, resourceVariablesBulkUpdateEvent.Variables)
	if err != nil {
		return err
	}

	if hasChanges {
		releaseTargets := ws.ReleaseTargets().GetForResource(ctx, resourceVariablesBulkUpdateEvent.ResourceId)
		for _, rt := range releaseTargets {
			ws.ReleaseManager().DirtyDesiredRelease(rt)
		}
		ws.ReleaseManager().RecomputeState(ctx)
		if err := ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
			releasemanager.WithTrigger(trace.TriggerVariablesUpdated)); err != nil {
			return err
		}
	}

	return nil
}
