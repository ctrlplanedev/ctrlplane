package resources

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/relationships/compute"
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

func computeRelations(ctx context.Context, ws *workspace.Workspace, resource *oapi.Resource) []*relationships.EntityRelation {
	rules := make([]*oapi.RelationshipRule, 0)
	for _, rule := range ws.RelationshipRules().Items() {
		rules = append(rules, rule)
	}
	entity := relationships.NewResourceEntity(resource)
	return compute.FindRelationsForEntity(ctx, rules, entity, ws.Relations().GetRelatableEntities(ctx))
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

	relations := computeRelations(ctx, ws, resource)
	for _, relation := range relations {
		_ = ws.Relations().Upsert(ctx, relation)
	}

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

	oldReleaseTargets := ws.ReleaseTargets().GetForResource(ctx, resource.Id)
	oldRelations := ws.Relations().ForEntity(relationships.NewResourceEntity(resource))
	newRelations := computeRelations(ctx, ws, resource)
	removedRelations := compute.FindRemovedRelations(ctx, oldRelations, newRelations)

	for _, removedRelation := range removedRelations {
		ws.Relations().Remove(removedRelation.Key())
	}

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
	entity := relationships.NewResourceEntity(resource)
	oldRelations := ws.Relations().ForEntity(entity)
	for _, oldRelation := range oldRelations {
		ws.Relations().Remove(oldRelation.Key())
	}

	ws.Resources().Remove(ctx, resource.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
