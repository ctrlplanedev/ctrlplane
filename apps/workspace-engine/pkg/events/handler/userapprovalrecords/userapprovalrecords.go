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

	return nil
}

func HandleUserApprovalRecordUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	userApprovalRecord := &pb.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

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

	return nil
}