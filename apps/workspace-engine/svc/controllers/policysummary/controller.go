package policysummary

import (
	"context"
	"fmt"
	"runtime"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/workspace/manager"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/policysummary")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	setter Setter
}

func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "policysummary.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	ws, ok := manager.Workspaces().Get(item.WorkspaceID)
	if !ok {
		return reconcile.Result{}, fmt.Errorf("workspace %s not found", item.WorkspaceID)
	}

	getter := NewStoreGetter(ws)

	result, err := Reconcile(ctx, item.WorkspaceID, item.ScopeID, getter, c.setter)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("reconcile policy summary: %w", err)
	}

	if result.NextReconcileAt != nil {
		span.SetAttributes(attribute.String("next_reconcile_at", result.NextReconcileAt.Format(time.RFC3339)))
		return reconcile.Result{RequeueAfter: time.Until(*result.NextReconcileAt)}, nil
	}

	return reconcile.Result{}, nil
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	log.Debug(
		"Creating policy summary reconcile worker",
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

	kind := events.PolicySummaryKind
	queue := postgres.NewForKinds(pgxPool, kind)
	queries := db.New(pgxPool)
	controller := &Controller{
		setter: NewPostgresSetter(queries),
	}
	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create policy summary reconcile worker", "error", err)
	}

	return worker
}
