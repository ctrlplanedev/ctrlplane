package tick

import (
	"context"
	"encoding/json"
	"time"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("events/handler/tick")

func SendWorkspaceTick(ctx context.Context, producer messaging.Producer, wsId string) error {
	event := map[string]any{
		"eventType":   handler.WorkspaceTick,
		"workspaceId": wsId,
		"timestamp":   time.Now().Unix(),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return producer.Publish([]byte(wsId), eventBytes)
}

// HandleWorkspaceTick handles periodic workspace tick events by intelligently reconciling
// release targets that may be affected by time-sensitive policies. This is needed for:
// - Environment progression soak time (wait N minutes after deployment)
// - Environment progression maximum age (deployments become too old)
// - Gradual rollout policies (time-based progressive deployment)
//
// Optimization: Instead of reconciling ALL release targets on every tick, we filter to only
// those that actually need time-based re-evaluation:
// 1. Release targets whose deployments have time-sensitive policies
// 2. Release targets with recent job activity (might be in soak/progression window)
// 3. Release targets with no jobs yet (might be waiting for a time window)
func HandleWorkspaceTick(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	_, span := tracer.Start(ctx, "HandleWorkspaceTick")
	defer span.End()
	span.SetAttributes(
		attribute.String("workspace.id", ws.ID),
		attribute.String("event.type", string(event.EventType)),
	)

	releaseTargets, err := ws.ReleaseTargets().Items()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get release targets")
		return err
	}

	releaseTargetsSlice := make([]*oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, rt := range releaseTargets {
		releaseTargetsSlice = append(releaseTargetsSlice, rt)
	}

	concurrency.ProcessInChunks(
		releaseTargetsSlice,
		100,
		20,
		func(rt *oapi.ReleaseTarget) (any, error) {
			err := ws.ReleaseManager().ReconcileTarget(ctx, rt, false)
			if err != nil {
				log.Error("failed to reconcile release target", "error", err)
			}
			return nil, nil
		},
	)

	return nil
}
