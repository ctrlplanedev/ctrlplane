package environment

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func makeReleaseTargets(ctx context.Context, ws *workspace.Workspace, environment *oapi.Environment) ([]*oapi.ReleaseTarget, error) {
	deployments := ws.Systems().Deployments(environment.SystemId)
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
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
				releaseTargets = append(releaseTargets, &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				})
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

	releaseTargets, err := makeReleaseTargets(ctx, ws, environment)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
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

	releaseTargets, err := makeReleaseTargets(ctx, ws, environment)
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

	ws.Environments().Remove(ctx, environment.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
