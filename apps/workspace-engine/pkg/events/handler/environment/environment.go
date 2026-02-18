package environment

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func makeReleaseTargets(ctx context.Context, ws *workspace.Workspace, environment *oapi.Environment) ([]*oapi.ReleaseTarget, error) {
	seen := make(map[string]struct{})
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, systemID := range ws.SystemEnvironments().GetSystemIDsForEnvironment(environment.Id) {
		deployments := ws.Systems().Deployments(systemID)
		for _, deployment := range deployments {
			resources, err := ws.Deployments().Resources(ctx, deployment.Id)
			if err != nil {
				return nil, err
			}
			for _, resource := range resources {
				isMatch, err := selector.Match(ctx, environment.ResourceSelector, resource)
				if err != nil {
					return nil, err
				}
				if isMatch {
					rt := &oapi.ReleaseTarget{
						EnvironmentId: environment.Id,
						DeploymentId:  deployment.Id,
						ResourceId:    resource.Id,
					}
					if _, ok := seen[rt.Key()]; !ok {
						seen[rt.Key()] = struct{}{}
						releaseTargets = append(releaseTargets, rt)
					}
				}
			}
		}
	}
	return releaseTargets, nil
}

func HandleEnvironmentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	if err := ws.Environments().Upsert(ctx, environment); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.AddEntity(ctx, environment.Id)

	releaseTargets, err := makeReleaseTargets(ctx, ws, environment)
	if err != nil {
		return err
	}

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithTrigger(trace.TriggerEnvironmentCreated))
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

func HandleEnvironmentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForEnvironment(ctx, environment.Id)
	if err != nil {
		return err
	}

	if err := ws.Environments().Upsert(ctx, environment); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.DirtyEntity(ctx, environment.Id)

	releaseTargets, err := makeReleaseTargets(ctx, ws, environment)
	if err != nil {
		return err
	}

	removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
	addedReleaseTargets := getAddedReleaseTargets(oldReleaseTargets, releaseTargets)

	for _, removedReleaseTarget := range removedReleaseTargets {
		ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
	}

	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, addedReleaseTarget := range addedReleaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, addedReleaseTarget)
		if err != nil {
			return err
		}
		reconileReleaseTargets = append(reconileReleaseTargets, addedReleaseTarget)
	}

	for _, rt := range reconileReleaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerEnvironmentUpdated))

	return nil
}

func HandleEnvironmentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	environment := &oapi.Environment{}
	if err := json.Unmarshal(event.Data, environment); err != nil {
		return err
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForEnvironment(ctx, environment.Id)
	if err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.RemoveEntity(ctx, environment.Id)
	ws.Environments().Remove(ctx, environment.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
