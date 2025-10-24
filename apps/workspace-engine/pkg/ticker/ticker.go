package ticker

import (
	"context"
	"os"
	"strconv"
	"time"

	"workspace-engine/pkg/kafka/producer"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const (
	// DefaultTickInterval is the default interval for periodic evaluations
	DefaultTickInterval = 1 * time.Minute

	// WorkspaceTickEventType is the event type for periodic workspace ticks
	WorkspaceTickEventType = "workspace.tick"
)

var tracer = otel.Tracer("ticker")

// Ticker periodically emits tick events for active workspaces
type Ticker struct {
	producer  producer.EventProducer
	interval  time.Duration
	eventType string
}

// NewDefault creates a new ticker with the configured interval
func NewDefault(producer producer.EventProducer) *Ticker {
	interval := getTickInterval()
	log.Info("Ticker initialized", "interval", interval)

	return &Ticker{
		producer:  producer,
		interval:  interval,
		eventType: WorkspaceTickEventType,
	}
}

// New creates a new ticker with the configured interval and event type
func New(producer producer.EventProducer, interval time.Duration, eventType string) *Ticker {
	return &Ticker{
		producer:  producer,
		interval:  interval,
		eventType: eventType,
	}
}

// getTickInterval reads the tick interval from environment variable
func getTickInterval() time.Duration {
	intervalStr := os.Getenv("WORKSPACE_TICK_INTERVAL_SECONDS")
	if intervalStr == "" {
		return DefaultTickInterval
	}

	seconds, err := strconv.Atoi(intervalStr)
	if err != nil {
		log.Warn("Invalid WORKSPACE_TICK_INTERVAL_SECONDS, using default",
			"value", intervalStr,
			"default", DefaultTickInterval)
		return DefaultTickInterval
	}

	if seconds <= 0 {
		log.Warn("WORKSPACE_TICK_INTERVAL_SECONDS must be positive, using default",
			"value", seconds,
			"default", DefaultTickInterval)
		return DefaultTickInterval
	}

	return time.Duration(seconds) * time.Second
}

// Run starts the ticker loop, emitting periodic tick events for all active workspaces
func (t *Ticker) Run(ctx context.Context) error {
	ticker := time.NewTicker(t.interval)
	defer ticker.Stop()

	log.Info("Ticker started", "interval", t.interval)

	// Emit first tick immediately
	if err := t.emitTicks(ctx); err != nil {
		log.Error("Failed to emit initial ticks", "error", err)
	}

	for {
		select {
		case <-ticker.C:
			if err := t.emitTicks(ctx); err != nil {
				log.Error("Failed to emit ticks", "error", err)
				// Continue running even if one tick fails
			}

		case <-ctx.Done():
			log.Info("Ticker stopped")
			return nil
		}
	}
}

// emitTicks emits a tick event for each active workspace
func (t *Ticker) emitTicks(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "EmitTicks")
	defer span.End()

	workspaceIDs := workspace.GetAllWorkspaceIds()
	span.SetAttributes(attribute.Int("workspace.count", len(workspaceIDs)))

	if len(workspaceIDs) == 0 {
		log.Debug("No active workspaces to tick")
		span.SetStatus(codes.Ok, "no workspaces to tick")
		return nil
	}

	successCount := 0
	errorCount := 0

	for _, workspaceID := range workspaceIDs {
		if err := t.emitTickForWorkspace(ctx, workspaceID); err != nil {
			log.Error("Failed to emit tick for workspace",
				"workspaceID", workspaceID,
				"error", err)
			errorCount++
		} else {
			successCount++
		}
	}

	span.SetAttributes(
		attribute.Int("tick.success_count", successCount),
		attribute.Int("tick.error_count", errorCount),
	)

	log.Debug("Emitted ticks",
		"total", len(workspaceIDs),
		"success", successCount,
		"errors", errorCount)

	if errorCount > 0 {
		span.SetStatus(codes.Error, "some ticks failed")
	} else {
		span.SetStatus(codes.Ok, "all ticks emitted")
	}

	return nil
}

// emitTickForWorkspace emits a single tick event for a workspace
func (t *Ticker) emitTickForWorkspace(ctx context.Context, workspaceID string) error {
	_, span := tracer.Start(ctx, "EmitTickForWorkspace")
	defer span.End()

	span.SetAttributes(attribute.String("workspace.id", workspaceID))

	err := t.producer.ProduceEvent(t.eventType, workspaceID, nil)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to produce tick event")
		return err
	}

	span.SetStatus(codes.Ok, "tick event produced")
	return nil
}
