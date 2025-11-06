package resources

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func makeReleaseTargets(ctx context.Context, ws *workspace.Workspace, resource *oapi.Resource) ([]*oapi.ReleaseTarget, error) {
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

	releaseTargets, err := makeReleaseTargets(ctx, ws, resource)
	if err != nil {
		return err
	}

	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}

		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
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

func getAddedReleaseTargets(oldReleaseTargets []*oapi.ReleaseTarget, newReleaseTargets []*oapi.ReleaseTarget) []*oapi.ReleaseTarget {
	addedReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, newReleaseTarget := range newReleaseTargets {
		found := false
		for _, oldReleaseTarget := range oldReleaseTargets {
			if oldReleaseTarget.Key() == newReleaseTarget.Key() {
				found = true
				break
			}
		}
		if !found {
			addedReleaseTargets = append(addedReleaseTargets, newReleaseTarget)
		}
	}
	return addedReleaseTargets
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

	// Get old resource for comparison (to detect property changes)
	// oldResource, exists := ws.Resources().Get(resource.Id)

	if _, err := ws.Resources().Upsert(ctx, resource); err != nil {
		return err
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForResource(ctx, resource.Id)
	if err != nil {
		return err
	}

	releaseTargets, err := makeReleaseTargets(ctx, ws, resource)
	if err != nil {
		return err
	}

	removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
	addedReleaseTargets := getAddedReleaseTargets(oldReleaseTargets, releaseTargets)

	for _, removedReleaseTarget := range removedReleaseTargets {
		ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
	}

	for _, addedReleaseTarget := range addedReleaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, addedReleaseTarget)
		if err != nil {
			return err
		}

		ws.ReleaseManager().ReconcileTarget(ctx, addedReleaseTarget, false)
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

	oldReleaseTargets, err := ws.ReleaseTargets().GetForResource(ctx, resource.Id)
	if err != nil {
		return err
	}

	ws.Resources().Remove(ctx, resource.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
