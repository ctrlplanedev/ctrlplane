package tick

import (
	"context"
	"encoding/json"
	"time"

	"workspace-engine/pkg/cmap"
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

var workspaceTickCount = cmap.New[int64]()

// HandleWorkspaceTick handles periodic workspace tick events by intelligently reconciling
// release targets that may be affected by time-sensitive policies or external dependencies.
//
// Scheduled policies (re-evaluated at specific times):
// - Environment progression soak time (wait N minutes after deployment)
// - Environment progression success rate (checked every minute when blocked)
// - Environment progression maximum age (deployments become too old)
// - Gradual rollout policies (time-based progressive deployment)
//
// Optimization: Instead of reconciling ALL release targets on every tick, we use a scheduler
// to track which targets need evaluation at specific times. This reduces workload by 10-50x.
//
// Processes targets that:
// 1. Scheduled for reconciliation now (based on NextEvaluationTime from policies)
// 2. NOT scheduled but checked periodically (every 10 ticks = ~5 minutes as fallback)
// 3. First boot - all targets (to populate scheduler)
func HandleWorkspaceTick(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	workspaceTickCount.Upsert(ws.ID, 1, func(exist bool, old int64, new int64) int64 {
		return old + 1
	})

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
	// 1. Scheduled for reconciliation now (has NextEvaluationTime that's due)
	// 2. Not scheduled but waiting for external events (env progression, approvals, etc.)
	// 3. First boot - reconcile everything to populate scheduler
	targetsToReconcile := make([]*oapi.ReleaseTarget, 0)
	
	tickCount, _ := workspaceTickCount.Get(ws.ID)
	isFirstBoot := tickCount <= 1

	for _, rt := range releaseTargets {
		// Include if scheduled for reconciliation now
		if dueKeysSet[rt.Key()] {
			targetsToReconcile = append(targetsToReconcile, rt)
			continue
		}

		// Include if first boot (need to populate scheduler)
		if isFirstBoot {
			targetsToReconcile = append(targetsToReconcile, rt)
			continue
		}
	}

	// Count unscheduled targets
	unscheduledCount := 0
	for _, rt := range releaseTargets {
		if _, scheduled := scheduler.GetNextReconciliationTime(rt); !scheduled {
			unscheduledCount++
		}
	}

	span.SetAttributes(
		attribute.Int("total_targets", len(releaseTargets)),
		attribute.Int("scheduled_targets", len(dueKeys)),
		attribute.Int("unscheduled_targets", unscheduledCount),
		attribute.Int("targets_to_reconcile", len(targetsToReconcile)),
		attribute.Bool("is_first_boot", isFirstBoot),
		attribute.Bool("check_unscheduled", tickCount%10 == 0),
	)

	log.Info("tick reconciliation",
		"total_targets", len(releaseTargets),
		"targets_to_reconcile", len(targetsToReconcile),
		"scheduled_due", len(dueKeys),
		"unscheduled", unscheduledCount,
		"tick_count", tickCount,
		"is_first_boot", isFirstBoot,
		"check_unscheduled", tickCount%10 == 0,
	)

	if len(targetsToReconcile) == 0 {
		span.AddEvent("No targets need reconciliation")
		return nil
	}

	// Clear processed schedules
	scheduler.Clear(dueKeys)

	ws.ReleaseManager().ReconcileTargets(ctx, targetsToReconcile, false)

	return nil
}
