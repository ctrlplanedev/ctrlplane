package userapprovalrecords

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"github.com/charmbracelet/log"
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

	version, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if !ok {
		return fmt.Errorf("version %s not found", userApprovalRecord.VersionId)
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}

	// Invalidate cache for affected targets so planning phase re-evaluates with new approval
	for _, rt := range relevantTargets {
		ws.ReleaseManager().InvalidateReleaseTargetState(rt)
	}

	log.Info("Approval created - reconciling affected targets",
		"version_id", userApprovalRecord.VersionId,
		"environment_id", userApprovalRecord.EnvironmentId,
		"affected_targets_count", len(relevantTargets))

	_ = ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets,
		releasemanager.WithTrigger(trace.TriggerApprovalCreated),
		releasemanager.WithVersionAndNewer(version))

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

	version, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if !ok {
		return fmt.Errorf("version %s not found", userApprovalRecord.VersionId)
	}

	ws.UserApprovalRecords().Upsert(ctx, userApprovalRecord)

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}

	// Invalidate cache for affected targets so planning phase re-evaluates with new approval
	for _, rt := range relevantTargets {
		ws.ReleaseManager().InvalidateReleaseTargetState(rt)
	}

	_ = ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets,
		releasemanager.WithTrigger(trace.TriggerApprovalUpdated),
		releasemanager.WithVersionAndNewer(version))

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

	version, ok := ws.DeploymentVersions().Get(userApprovalRecord.VersionId)
	if !ok {
		return fmt.Errorf("version %s not found", userApprovalRecord.VersionId)
	}

	ws.UserApprovalRecords().Remove(ctx, userApprovalRecord.Key())

	relevantTargets, err := getRelevantTargets(ctx, ws, userApprovalRecord)
	if err != nil {
		return err
	}

	// Invalidate cache for affected targets so planning phase re-evaluates without the approval
	for _, rt := range relevantTargets {
		ws.ReleaseManager().InvalidateReleaseTargetState(rt)
	}

	_ = ws.ReleaseManager().ReconcileTargets(ctx, relevantTargets,
		releasemanager.WithTrigger(trace.TriggerApprovalUpdated),
		releasemanager.WithVersionAndNewer(version))

	return nil
}
