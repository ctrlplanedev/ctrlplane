package jobdispatch

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/github"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/testrunner"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/jobdispatch")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter     Getter
	setter     Setter
	dispatcher Dispatcher
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.Controller.Process")
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
		return reconcile.Result{}, fmt.Errorf("parse release target: %w", err)
	}

	exists, err := c.getter.ReleaseTargetExists(ctx, rt)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("check release target exists: %w", err)
	}

	span.SetAttributes(attribute.Bool("release_target.exists", exists))
	if !exists {
		return reconcile.Result{}, nil
	}

	result, err := Reconcile(ctx, c.getter, c.setter, rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("reconcile job dispatch: %w", err)
	}

	if result.RequeueAfter != nil {
		span.SetAttributes(attribute.String("requeue_after", result.RequeueAfter.String()))
		return reconcile.Result{RequeueAfter: *result.RequeueAfter}, nil
	}

	return reconcile.Result{}, nil
}

// NewController creates a Controller with the given dependencies.
// Use this constructor in tests to inject mock implementations.
func NewController(getter Getter, setter Setter, dispatcher Dispatcher) *Controller {
	return &Controller{getter: getter, setter: setter, dispatcher: dispatcher}
}

func New(workerID string, pgxPool *pgxpool.Pool) *reconcile.Worker {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	dispatcher := jobagents.NewRegistry(&PostgresGetter{})
	dispatcher.Register(testrunner.New(&PostgresSetter{}))
	dispatcher.Register(github.New(&github.GoGitHubWorkflowDispatcher{}, &PostgresSetter{}))

	log.Debug(
		"Creating job dispatch reconcile worker",
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

	kind := "job-dispatch"
	queue := postgres.NewForKinds(pgxPool, kind)
	controller := &Controller{
		getter:     &PostgresGetter{},
		setter:     &PostgresSetter{},
		dispatcher: dispatcher,
	}
	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create job dispatch reconcile worker", "error", err)
	}

	return worker
}
