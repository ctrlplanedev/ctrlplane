package policyeval

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/policyeval")
var _ reconcile.Processor = (*Controller)(nil)

// Controller evaluates policy rules for a deployment version against all of
// its release targets. The version ID is the queue scope.
type Controller struct {
	getter  Getter // set for tests via NewController; nil for prod
	queries *db.Queries
	setter  Setter
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "policyeval.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	versionID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("parse version id from scope: %w", err)
	}

	getter := c.getter
	if getter == nil {
		cacheTTL := 5 * time.Minute
		rtForDep := releasetargets.NewGetReleaseTargetsForDeployment(releasetargets.WithCache(cacheTTL))
		rtForDepEnv := releasetargets.NewGetReleaseTargetsForDeploymentAndEnvironment(releasetargets.WithCache(cacheTTL))
		getter = NewPostgresGetter(c.queries, rtForDep, rtForDepEnv)
	}

	_, err = Reconcile(ctx, getter, c.setter, versionID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("reconcile policy eval: %w", err)
	}

	return reconcile.Result{}, nil
}

// NewController creates a Controller with the given dependencies.
// Use this constructor in tests to inject mock implementations.
func NewController(getter Getter, setter Setter) *Controller {
	return &Controller{getter: getter, setter: setter}
}

// New creates a production-ready policy eval worker backed by Postgres.
func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	kind := events.PolicyEvalKind
	maxConcurrency := config.GetMaxConcurrency(kind)
	log.Debug(
		"Creating policy eval reconcile worker",
		"maxConcurrency", maxConcurrency,
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   10 * time.Second,
		LeaseHeartbeat:  5 * time.Second,
		MaxConcurrency:  maxConcurrency,
		MaxRetryBackoff: 10 * time.Second,
	}

	ctx := context.Background()
	queue := postgres.NewForKinds(pgxPool, kind)
	controller := &Controller{
		queries: db.GetQueries(ctx),
		setter:  NewPostgresSetter(),
	}
	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create policy eval reconcile worker", "error", err)
	}

	return worker
}
