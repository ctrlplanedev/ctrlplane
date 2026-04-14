package forcedeploy

import (
	"context"
	"fmt"
	"time"

	"github.com/charmbracelet/log"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/svc"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/forcedeploy")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter Getter
	setter Setter
}

func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "forcedeploy.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.scope_id", item.ScopeID),
	)

	rt, err := NewReleaseTarget(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("parse release target: %w", err)
	}

	exists, err := c.getter.ReleaseTargetExists(ctx, rt)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("check release target exists: %w", err)
	}
	if !exists {
		return reconcile.Result{}, nil
	}

	result, err := Reconcile(ctx, item.WorkspaceID, c.getter, c.setter, rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("reconcile force deploy: %w", err)
	}

	if result.RequeueAfter > 0 {
		return reconcile.Result{RequeueAfter: result.RequeueAfter}, nil
	}

	return reconcile.Result{}, nil
}

// NewController creates a Controller with the given dependencies.
// Use this constructor in tests to inject mock implementations.
func NewController(getter Getter, setter Setter) *Controller {
	return &Controller{getter: getter, setter: setter}
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	kind := events.ForceDeployKind
	maxConcurrency := config.GetMaxConcurrency(kind)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   10 * time.Second,
		LeaseHeartbeat:  5 * time.Second,
		MaxConcurrency:  maxConcurrency,
		MaxRetryBackoff: 10 * time.Second,
	}

	queue := postgres.NewForKinds(pgxPool, kind)
	controller := &Controller{
		getter: &PostgresGetter{},
		setter: &PostgresSetter{},
	}

	worker, err := reconcile.NewWorker(kind, queue, controller, nodeConfig)
	if err != nil {
		log.Fatal("Failed to create force deploy reconcile worker", "error", err)
	}

	return worker
}
