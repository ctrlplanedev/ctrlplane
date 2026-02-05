package policyskip

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func getRelevantTargets(
	ctx context.Context,
	ws *workspace.Workspace,
	skip *oapi.PolicySkip,
) ([]*oapi.ReleaseTarget, *oapi.DeploymentVersion, error) {
	version, ok := ws.DeploymentVersions().Get(skip.VersionId)
	if !ok {
		return nil, nil, fmt.Errorf("version %s not found", skip.VersionId)
	}

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, version.DeploymentId)
	if err != nil {
		return nil, nil, err
	}

	filteredTargets := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, target := range releaseTargets {
		if skip.EnvironmentId != nil && target.EnvironmentId != *skip.EnvironmentId {
			continue
		}
		if skip.ResourceId != nil && target.ResourceId != *skip.ResourceId {
			continue
		}
		filteredTargets = append(filteredTargets, target)
	}

	return filteredTargets, version, nil
}

func HandlePolicySkipCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	skip := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, skip); err != nil {
		return err
	}

	ws.Store().PolicySkips.Upsert(ctx, skip)

	relevantTargets, version, err := getRelevantTargets(ctx, ws, skip)
	if err != nil {
		return err
	}

	for _, target := range relevantTargets {
		ws.ReleaseManager().InvalidateReleaseTargetState(target)
	}

	_ = ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets,
		releasemanager.WithTrigger(trace.TriggerPolicyUpdated),
		releasemanager.WithVersionAndNewer(version))
	return nil
}

func HandlePolicySkipDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	skip := &oapi.PolicySkip{}
	if err := json.Unmarshal(event.Data, skip); err != nil {
		return err
	}

	ws.Store().PolicySkips.Remove(ctx, skip.Id)
	return nil
}
