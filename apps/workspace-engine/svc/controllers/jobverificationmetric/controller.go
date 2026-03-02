package jobverificationmetric

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/jobverificationmetric")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter Getter
	setter Setter
}

func NewController(getter Getter, setter Setter) *Controller {
	return &Controller{getter: getter, setter: setter}
}

// Process implements [reconcile.Processor]. The item's ScopeID is the
// verification_metric.id UUID.
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "verification.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	result, err := Reconcile(ctx, c.getter, c.setter, item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("reconcile verification metric: %w", err)
	}

	if result.RequeueAfter != nil {
		span.SetAttributes(attribute.String("requeue_after", result.RequeueAfter.String()))
		return reconcile.Result{RequeueAfter: *result.RequeueAfter}, nil
	}

	return reconcile.Result{}, nil
}

func New(workerID string, pgxPool *pgxpool.Pool) *reconcile.Worker {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	log.Debug(
		"Creating verification reconcile worker",
		"maxConcurrency", runtime.GOMAXPROCS(0),
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   30 * time.Second,
		LeaseHeartbeat:  10 * time.Second,
		MaxConcurrency:  runtime.GOMAXPROCS(0),
		MaxRetryBackoff: 30 * time.Second,
	}

	kind := "verification-metric"
	queue := postgres.NewForKinds(pgxPool, kind)
	enqueueQueue := postgres.New(pgxPool)
	controller := &Controller{
		getter: &PostgresGetter{},
		setter: &PostgresSetter{Queue: enqueueQueue},
	}
	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create verification reconcile worker", "error", err)
	}

	return worker
}
