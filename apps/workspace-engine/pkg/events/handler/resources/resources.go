package resources

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func computeReleaseTargets(ctx context.Context, ws *workspace.Workspace, resource *oapi.Resource) ([]*oapi.ReleaseTarget, error) {
	environments, err := ws.Environments().ForResource(ctx, resource)
	if err != nil {
		return nil, err
	}
	deployments, err := ws.Deployments().ForResource(ctx, resource)
	if err != nil {
		return nil, err
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, environment := range environments {
		for _, deployment := range deployments {
			if environment.SystemId != deployment.SystemId {
				continue
			}

			releaseTargets = append(releaseTargets, &oapi.ReleaseTarget{
				EnvironmentId: environment.Id,
				DeploymentId:  deployment.Id,
				ResourceId:    resource.Id,
			})
		}
	}

	return releaseTargets, nil
}

func HandleResourceCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	resource.WorkspaceId = ws.ID

	if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.AddEntity(ctx, resource.Id)

	releaseTargets, err := computeReleaseTargets(ctx, ws, resource)
	if err != nil {
		return err
	}

	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseTargets().Upsert(ctx, releaseTarget)
	}

	return nil
}

func getRemovedReleaseTargets(oldReleaseTargets []*oapi.ReleaseTarget, newReleaseTargets []*oapi.ReleaseTarget) []*oapi.ReleaseTarget {
	removedReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, oldReleaseTarget := range oldReleaseTargets {
		found := false
		for _, newReleaseTarget := range newReleaseTargets {
			if oldReleaseTarget.Key() == newReleaseTarget.Key() {
				found = true
				break
			}
		}
		if !found {
			removedReleaseTargets = append(removedReleaseTargets, oldReleaseTarget)
		}
	}
	return removedReleaseTargets
}

func HandleResourceUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.DirtyEntity(ctx, resource.Id)

	oldReleaseTargets := ws.ReleaseTargets().GetForResource(ctx, resource.Id)
	releaseTargets, err := computeReleaseTargets(ctx, ws, resource)
	if err != nil {
		return err
	}

	removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
	for _, removedReleaseTarget := range removedReleaseTargets {
		ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
	}

	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}
	}

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithTrigger(trace.TriggerResourceCreated))
	}

	return nil
}

func HandleResourceDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resource := &oapi.Resource{}
	if err := json.Unmarshal(event.Data, resource); err != nil {
		return err
	}

	oldReleaseTargets := ws.ReleaseTargets().GetForResource(ctx, resource.Id)

	ws.Store().RelationshipIndexes.RemoveEntity(ctx, resource.Id)
	ws.Resources().Remove(ctx, resource.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
