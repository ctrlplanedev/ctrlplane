package desiredrelease

import (
	"context"
	"fmt"
	"runtime"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/desiredrelease")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter Getter
	setter Setter
	queue  reconcile.Queue
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) error {
	ctx, span := tracer.Start(ctx, "desiredrelease.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	rt, err := NewReleaseTarget(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("parse release target: %w", err)
	}

	result, err := Reconcile(ctx, c.getter, c.setter, rt)
	if err != nil {
		return err
	}

	if result.NextReconcileAt != nil {
		span.SetAttributes(attribute.String("next_reconcile_at", result.NextReconcileAt.Format(time.RFC3339)))
		if enqErr := c.queue.Enqueue(ctx, reconcile.EnqueueParams{
			Kind:      item.Kind,
			ScopeType: item.ScopeType,
			ScopeID:   item.ScopeID,
			NotBefore: *result.NextReconcileAt,
		}); enqErr != nil {
			span.RecordError(enqErr)
			span.SetStatus(codes.Error, "re-enqueue failed")
			return fmt.Errorf("re-enqueue for next reconcile: %w", enqErr)
		}
	}

	return nil
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	log.Debug(
		"Creating desired release reconcile worker",
		"maxConcurrency", runtime.GOMAXPROCS(0),
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   10 * time.Second,
		LeaseHeartbeat:  5 * time.Second,
		MaxConcurrency:  runtime.GOMAXPROCS(0),
		MaxRetryBackoff: 10 * time.Second,
	}

	kind := "desired-release"
	queue := postgres.NewForKinds(pgxPool, kind)
	controller := &Controller{
		getter: &PostgresGetter{},
		setter: &PostgresSetter{},
		queue:  queue,
	}
	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create desired release reconcile worker", "error", err)
	}

	return worker
}
