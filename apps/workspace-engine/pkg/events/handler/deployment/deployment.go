package deployment

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func makeReleaseTargets(ctx context.Context, ws *workspace.Workspace, deployment *oapi.Deployment) ([]*oapi.ReleaseTarget, error) {
	seen := make(map[string]struct{})
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, systemID := range ws.SystemDeployments().GetSystemIDsForDeployment(deployment.Id) {
		environments := ws.Systems().Environments(systemID)
		for _, environment := range environments {
			resources, err := ws.Environments().Resources(ctx, environment.Id)
			if err != nil {
				return nil, err
			}
			for _, resource := range resources {
				isMatch, err := selector.Match(ctx, deployment.ResourceSelector, resource)
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

func HandleDeploymentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.AddEntity(ctx, deployment.Id)

	releaseTargets, err := makeReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}

		if deployment.JobAgentId != nil && *deployment.JobAgentId != "" {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	for _, rt := range reconileReleaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets,
		releasemanager.WithTrigger(trace.TriggerDeploymentCreated))

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

func upsertTargets(ctx context.Context, ws *workspace.Workspace, releaseTargets []*oapi.ReleaseTarget) error {
	for _, releaseTarget := range releaseTargets {
		err := ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		if err != nil {
			return err
		}
	}
	return nil
}

func reconcileTargets(ctx context.Context, ws *workspace.Workspace, deployment *oapi.Deployment, releaseTargets []*oapi.ReleaseTarget, skipEligibilityCheck bool) error {
	if deployment.JobAgentId != nil && *deployment.JobAgentId != "" {
		for _, rt := range releaseTargets {
			ws.ReleaseManager().DirtyDesiredRelease(rt)
		}
		ws.ReleaseManager().RecomputeState(ctx)

		for _, releaseTarget := range releaseTargets {
			_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
				releasemanager.WithTrigger(trace.TriggerDeploymentUpdated),
				releasemanager.WithSkipEligibilityCheck(skipEligibilityCheck),
			)
		}
	}
	return nil
}

func getOldDeployment(ws *workspace.Workspace, deploymentID string) (oapi.Deployment, error) {
	oldDeployment, ok := ws.Deployments().Get(deploymentID)
	if !ok {
		return oapi.Deployment{}, fmt.Errorf("deployment %s not found", deploymentID)
	}
	if oldDeployment == nil {
		return oapi.Deployment{}, fmt.Errorf("deployment %s not found", deploymentID)
	}
	return *oldDeployment, nil
}

func isJobAgentConfigurationChanged(oldDeployment *oapi.Deployment, newDeployment *oapi.Deployment) bool {
	oldAgentId := ""
	if oldDeployment.JobAgentId != nil {
		oldAgentId = *oldDeployment.JobAgentId
	}
	newAgentId := ""
	if newDeployment.JobAgentId != nil {
		newAgentId = *newDeployment.JobAgentId
	}
	if oldAgentId != newAgentId {
		return true
	}

	oldConfig, _ := json.Marshal(oldDeployment.JobAgentConfig)
	newConfig, _ := json.Marshal(newDeployment.JobAgentConfig)
	if string(oldConfig) != string(newConfig) {
		return true
	}

	oldAgents, _ := json.Marshal(oldDeployment.JobAgents)
	newAgents, _ := json.Marshal(newDeployment.JobAgents)
	return string(oldAgents) != string(newAgents)
}

func HandleDeploymentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	oldDeployment, err := getOldDeployment(ws, deployment.Id)
	if err != nil {
		return HandleDeploymentCreated(ctx, ws, event)
	}

	if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.DirtyEntity(ctx, deployment.Id)

	releaseTargets, err := makeReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
	for _, removedReleaseTarget := range removedReleaseTargets {
		ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
	}

	addedReleaseTargets := getAddedReleaseTargets(oldReleaseTargets, releaseTargets)
	err = upsertTargets(ctx, ws, addedReleaseTargets)
	if err != nil {
		return err
	}

	if isJobAgentConfigurationChanged(&oldDeployment, deployment) {
		return reconcileTargets(ctx, ws, deployment, releaseTargets, true)
	}

	return reconcileTargets(ctx, ws, deployment, addedReleaseTargets, false)
}

func HandleDeploymentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &oapi.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	ws.Store().RelationshipIndexes.RemoveEntity(ctx, deployment.Id)
	ws.Deployments().Remove(ctx, deployment.Id)

	for _, oldReleaseTarget := range oldReleaseTargets {
		ws.ReleaseTargets().Remove(oldReleaseTarget.Key())
	}

	return nil
}
