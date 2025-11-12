package userapprovalrecords

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("events/handler/userapprovalrecords")

func getRelevantTargets(ctx context.Context, ws *workspace.Workspace, userApprovalRecord *oapi.UserApprovalRecord) ([]*oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "getRelevantTargets")
	defer span.End()
	span.SetAttributes(
		attribute.String("version_id", userApprovalRecord.VersionId),
		attribute.String("environment_id", userApprovalRecord.EnvironmentId),
	)

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
	ctx, span := tracer.Start(ctx, "HandleUserApprovalRecordCreated")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}
	ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets, false, trace.TriggerApprovalCreated)

	return nil
}

func HandleUserApprovalRecordUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleUserApprovalRecordUpdated")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}
	ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets, false, trace.TriggerApprovalUpdated)

	return nil
}

func HandleUserApprovalRecordDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleUserApprovalRecordDeleted")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

	userApprovalRecord := &oapi.UserApprovalRecord{}
	if err := json.Unmarshal(event.Data, userApprovalRecord); err != nil {
		return err
	}

	ws.UserApprovalRecords().Remove(ctx, userApprovalRecord.Key())

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}

	ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets, false, trace.TriggerApprovalUpdated)

	return nil
}
