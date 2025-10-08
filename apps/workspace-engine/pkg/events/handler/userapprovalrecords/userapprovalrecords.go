package userapprovalrecords

import (
	"context"
	"encoding/json"
	"errors"
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
	userApprovalRecord := &pb.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		var payload struct {
			New *pb.UserApprovalRecord `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' user approval record in update event")
		}
		userApprovalRecord = payload.New
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
