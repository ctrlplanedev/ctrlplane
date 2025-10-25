package tick

import (
	"context"
	"encoding/json"
	"time"

	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
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

// HandleWorkspaceTick handles periodic workspace tick events by marking all release targets
// as tainted to trigger re-evaluation. This is needed for time-sensitive policies like:
// - RRule deployment windows (time-based allow/deny windows)
// - Environment progression soak time (wait N minutes after deployment)
// - Environment progression maximum age (deployments become too old)
func HandleWorkspaceTick(ctx context.Context, ws *workspace.Workspace, event handler.RawEvent) error {
	ctx, span := tracer.Start(ctx, "HandleWorkspaceTick")
	defer span.End()

	span.SetAttributes(
		attribute.String("workspace.id", ws.ID),
		attribute.String("event.type", string(event.EventType)),
	)

	changeSet, ok := changeset.FromContext[any](ctx)
	if !ok {
		span.SetStatus(codes.Error, "changeset not found in context")
		return nil
	}

	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get release targets")
		return err
	}

	// Mark all release targets as tainted to trigger re-evaluation
	taintedCount := 0
	for _, rt := range releaseTargets {
		changeSet.Record(changeset.ChangeTypeTaint, rt)
		taintedCount++
	}

	span.SetAttributes(attribute.Int("release_targets.tainted", taintedCount))

	log.Debug("Workspace tick processed",
		"workspaceID", ws.ID,
		"tainted_count", taintedCount)

	span.SetStatus(codes.Ok, "tick processed")
	return nil
}
