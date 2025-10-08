package userapprovalrecords

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleUserApprovalRecordCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &pb.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)
	v, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if ok {
		ws.ReleaseManager().TaintDeploymentsReleaseTargets(v.DeploymentId)
	}

	return nil
}

func HandleUserApprovalRecordUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	// First check if the data has a "current" field
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	userApprovalRecord := &pb.UserApprovalRecord{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		if err := json.Unmarshal(currentData, userApprovalRecord); err != nil {
			return err
		}
	} else {
		// Parse directly as userApprovalRecord
		if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
			return err
		}
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)
	v, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if ok {
		ws.ReleaseManager().TaintDeploymentsReleaseTargets(v.DeploymentId)
	}

	return nil
}

func HandleUserApprovalRecordDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &pb.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Remove(userApprovalRecord.Key())
	v, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if ok {
		ws.ReleaseManager().TaintDeploymentsReleaseTargets(v.DeploymentId)
	}

	return nil
}
