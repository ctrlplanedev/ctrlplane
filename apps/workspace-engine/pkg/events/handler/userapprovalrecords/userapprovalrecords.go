package userapprovalrecords

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

func getRelevantTargets(ctx context.Context, ws *workspace.Workspace, userApprovalRecord *oapi.UserApprovalRecord) ([]*oapi.ReleaseTarget, error) {
	version, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if !ok {
		return nil, fmt.Errorf("version %s not found", userApprovalRecord.VersionId)
	}

	environment, ok := ws.Environments().Get(userApprovalRecord.EnvironmentId)
	if !ok {
		return nil, fmt.Errorf("environment %s not found", userApprovalRecord.EnvironmentId)
	}

	environmentTargets, err := ws.ReleaseTargets().GetForEnvironment(ctx, environment.Id)
	if err != nil {
		return nil, err
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, target := range environmentTargets {
		if target.DeploymentId == version.DeploymentId {
			releaseTargets = append(releaseTargets, target)
		}
	}
	return releaseTargets, nil
}

func HandleUserApprovalRecordCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}
	for _, target := range relevantTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, target, false)
	}

	return nil
}

func HandleUserApprovalRecordUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}
	for _, target := range relevantTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, target, false)
	}

	return nil
}

func HandleUserApprovalRecordDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Remove(ctx, userApprovalRecord.Key())

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}
	for _, target := range relevantTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, target, false)
	}

	return nil
}
