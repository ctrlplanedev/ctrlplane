package environmentresourceselectoreval

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
	"workspace-engine/pkg/store/resources"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/environmentresourceselectoreval")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter Getter
	setter Setter
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "environmentresourceselectoreval.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	environmentID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("parse environment id: %w", err)
	}

	environment, err := c.getter.GetEnvironmentInfo(ctx, environmentID)
	if err != nil {
		return reconcile.Result{}, err
	}

	resources, err := c.getter.GetResources(ctx, environment.WorkspaceID.String(), resources.GetResourcesOptions{
		CEL: environment.ResourceSelector,
	})
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("eval selectors: %w", err)
	}

	matchedIDs := make([]uuid.UUID, 0, len(resources))
	for _, resource := range resources {
		matchedIDs = append(matchedIDs, uuid.MustParse(resource.Id))
	}

	if err := c.setter.SetComputedEnvironmentResources(ctx, environmentID, matchedIDs); err != nil {
		return reconcile.Result{}, fmt.Errorf("set computed environment resources: %w", err)
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
	log.Debug(
		"Creating environment resourceselector eval worker",
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

	ctx := context.Background()
	kind := events.EnvironmentResourceselectorEvalKind
	controller := &Controller{
		getter: NewPostgresGetter(db.GetQueries(ctx)),
		setter: &PostgresSetter{},
	}
	worker, err := reconcile.NewWorker(
		kind,
		postgres.NewForKinds(pgxPool, kind),
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create environment resourceselector eval worker", "error", err)
	}

	return worker
}
