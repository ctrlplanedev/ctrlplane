package jobagents

import (
	"context"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"encoding/json"
)

func HandleJobAgentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &oapi.JobAgent{}
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Upsert(ctx, jobAgent)

	return nil
}

func getAffectedReleaseTargets(ctx context.Context, ws *workspace.Workspace, jobAgent *oapi.JobAgent) ([]*oapi.ReleaseTarget, error) {
	allDeployments, err := ws.Deployments().ForJobAgent(ctx, jobAgent)
	if err != nil {
		return nil, err
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, deployment := range allDeployments {
		deploymentReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
		if err != nil {
			return nil, err
		}
		releaseTargets = append(releaseTargets, deploymentReleaseTargets...)
	}
	return releaseTargets, nil
}

func HandleJobAgentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &oapi.JobAgent{}
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Upsert(ctx, jobAgent)

	affectedReleaseTargets, err := getAffectedReleaseTargets(ctx, ws, jobAgent)
	if err != nil {
		return err
	}
	for _, releaseTarget := range affectedReleaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithSkipEligibilityCheck(true),
			releasemanager.WithTrigger(trace.TriggerJobAgentUpdated))
	}

	return nil
}

func HandleJobAgentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	jobAgent := &oapi.JobAgent{}
	if err := json.Unmarshal(event.Data, jobAgent); err != nil {
		return err
	}

	ws.JobAgents().Remove(ctx, jobAgent.Id)

	return nil
}
