package userapprovalrecords

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleUserApprovalRecordCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &pb.UserApprovalRecord{}
	if err := protojson.Unmarshal(event.Data, userApprovalRecord); err != nil {
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
	if err := protojson.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
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
	if err := protojson.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Remove(userApprovalRecord.Key())
	v, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if ok {
		ws.ReleaseManager().TaintDeploymentsReleaseTargets(v.DeploymentId)
	}

	return nil
}
