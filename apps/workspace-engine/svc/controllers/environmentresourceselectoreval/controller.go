package environmentresourceselectoreval

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/errgroup"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/environmentresourceselectoreval")
var _ reconcile.Processor = (*Controller)(nil)

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource", "environment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

const streamBatchSize = 5000

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

	selector, err := celEnv.Compile(environment.ResourceSelector)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("compile environment selector: %w", err)
	}

	matchedIDs, err := c.evalResources(ctx, environment, selector)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("eval selectors: %w", err)
	}

	if err := c.setter.SetComputedEnvironmentResources(ctx, environmentID, matchedIDs); err != nil {
		return reconcile.Result{}, fmt.Errorf("set computed environment resources: %w", err)
	}

	return reconcile.Result{}, nil
}

// evalResources streams resources from the DB and evaluates the CEL selector
// concurrently, returning the IDs of all matched resources.
func (c *Controller) evalResources(ctx context.Context, environment *EnvironmentInfo, selector cel.Program) ([]uuid.UUID, error) {
	numWorkers := runtime.GOMAXPROCS(0)
	batches := make(chan []ResourceInfo, numWorkers)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		return c.getter.StreamResources(ctx, environment.WorkspaceID, streamBatchSize, batches)
	})

	var mu sync.Mutex
	var matchedIDs []uuid.UUID
	for range numWorkers {
		g.Go(func() error {
			celCtx := map[string]any{
				"resource":    nil,
				"environment": environment.Raw,
			}
			var local []uuid.UUID
			for batch := range batches {
				for _, resource := range batch {
					celCtx["resource"] = resource.Raw
					ok, err := celutil.EvalBool(selector, celCtx)
					if err != nil {
						return fmt.Errorf("eval selector for resource %s: %w", resource.ID, err)
					}
					if ok {
						local = append(local, resource.ID)
					}
				}
			}
			if len(local) > 0 {
				mu.Lock()
				matchedIDs = append(matchedIDs, local...)
				mu.Unlock()
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return matchedIDs, nil
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

	kind := "environment-resource-selector-eval"
	controller := &Controller{
		getter: &PostgresGetter{},
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
