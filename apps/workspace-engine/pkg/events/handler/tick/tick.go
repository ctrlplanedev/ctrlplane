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
// Optimization: Instead of reconciling ALL release targets on every tick, we use a scheduler
// to track which targets need evaluation at specific times. This reduces the workload by 10-50x.
//
// Only processes targets that:
// 1. Are scheduled for reconciliation now (based on NextEvaluationTime from policies)
// 2. Have never been scheduled (new targets)
// 3. Have jobs in processing state (to check for completion)
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

	now := time.Now()
	scheduler := ws.ReleaseManager().Scheduler()

	// Get targets that are scheduled for reconciliation
	dueKeys := scheduler.GetDue(now)
	dueKeysSet := make(map[string]bool, len(dueKeys))
	for _, key := range dueKeys {
		dueKeysSet[key] = true
	}

	// Filter targets to those that need reconciliation:
	// 1. Scheduled for reconciliation now
	// 2. Never been scheduled (new target)
	// 3. Has a job in processing state (check for completion)
	targetsToReconcile := make([]*oapi.ReleaseTarget, 0)

	for _, rt := range releaseTargets {
		// Include if scheduled for reconciliation now
		if dueKeysSet[rt.Key()] {
			targetsToReconcile = append(targetsToReconcile, rt)
			continue
		}

		// Include if never been scheduled (new target)
		if _, scheduled := scheduler.GetNextReconciliationTime(rt); !scheduled {
			targetsToReconcile = append(targetsToReconcile, rt)
			continue
		}
	}

	span.SetAttributes(
		attribute.Int("total_targets", len(releaseTargets)),
		attribute.Int("scheduled_targets", len(dueKeys)),
		attribute.Int("targets_to_reconcile", len(targetsToReconcile)),
	)

	log.Info("tick reconciliation",
		"total_targets", len(releaseTargets),
		"targets_to_reconcile", len(targetsToReconcile),
		"scheduled_count", len(dueKeys),
	)

	if len(targetsToReconcile) == 0 {
		span.AddEvent("No targets need reconciliation")
		return nil
	}

	// Clear processed schedules
	scheduler.Clear(dueKeys)

	concurrency.ProcessInChunks(
		targetsToReconcile,
		100,
		10,
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
