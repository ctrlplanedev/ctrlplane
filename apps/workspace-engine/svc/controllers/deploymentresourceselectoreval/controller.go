package deploymentresourceselectoreval

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
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/errgroup"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentresourceselectoreval")
var _ reconcile.Processor = (*Controller)(nil)

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource", "deployment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

const streamBatchSize = 5000

type Controller struct {
	getter Getter
	setter Setter
	queue  reconcile.Queue
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "deploymentresourceselectoreval.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	deploymentID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("parse deployment id: %w", err)
	}

	deployment, err := c.getter.GetDeploymentInfo(ctx, deploymentID)
	if err != nil {
		return reconcile.Result{}, err
	}

	selector, err := celEnv.Compile(deployment.ResourceSelector)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("compile deployment selector: %w", err)
	}

	matchedIDs, err := c.evalResources(ctx, deployment, selector)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("eval selectors: %w", err)
	}

	if err := c.setter.SetComputedDeploymentResources(ctx, deploymentID, matchedIDs); err != nil {
		return reconcile.Result{}, fmt.Errorf("set computed deployment resources: %w", err)
	}

	releaseTargets, err := c.getter.GetReleaseTargetsForDeployment(ctx, deploymentID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get release targets: %w", err)
	}

	span.SetAttributes(attribute.Int("release_targets", len(releaseTargets)))

	if len(releaseTargets) > 0 {
		if err := c.enqueueReleaseTargets(ctx, deployment.WorkspaceID, releaseTargets); err != nil {
			return reconcile.Result{}, fmt.Errorf("enqueue release targets: %w", err)
		}
	}

	return reconcile.Result{}, nil
}

func (c *Controller) enqueueReleaseTargets(ctx context.Context, workspaceID uuid.UUID, releaseTargets []ReleaseTarget) error {
	_, span := tracer.Start(ctx, "EnqueueReleaseTargets")
	defer span.End()
	span.SetAttributes(attribute.Int("count", len(releaseTargets)))

	wsID := workspaceID.String()
	items := make([]reconcile.EnqueueParams, len(releaseTargets))
	for i, rt := range releaseTargets {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: wsID,
			Kind:        "desired-release",
			ScopeType:   "release-target",
			ScopeID:     rt.DeploymentID.String() + ":" + rt.EnvironmentID.String() + ":" + rt.ResourceID.String(),
		}
	}
	return c.queue.EnqueueMany(ctx, items)
}

// evalResources streams resources from the DB and evaluates the CEL selector
// concurrently, returning the IDs of all matched resources.
func (c *Controller) evalResources(ctx context.Context, deployment *DeploymentInfo, selector cel.Program) ([]uuid.UUID, error) {
	ctx, span := tracer.Start(ctx, "EvalResources")
	defer span.End()

	numWorkers := runtime.GOMAXPROCS(0)
	span.SetAttributes(attribute.Int("num_workers", numWorkers))
	batches := make(chan []ResourceInfo, numWorkers)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		_, streamSpan := tracer.Start(ctx, "StreamResources")
		defer streamSpan.End()
		err := c.getter.StreamResources(ctx, deployment.WorkspaceID, streamBatchSize, batches)
		return err
	})

	deploymentMap, err := celutil.EntityToMap(deployment.Raw)
	if err != nil {
		return nil, fmt.Errorf("convert deployment to map: %w", err)
	}

	var mu sync.Mutex
	var matchedIDs []uuid.UUID
	for range numWorkers {
		g.Go(func() error {
			_, evalSpan := tracer.Start(ctx, "EvalResource.Worker")
			defer evalSpan.End()
			celCtx := map[string]any{
				"resource":   nil,
				"deployment": deploymentMap,
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
func NewController(getter Getter, setter Setter, queue reconcile.Queue) *Controller {
	return &Controller{getter: getter, setter: setter, queue: queue}
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	log.Debug(
		"Creating deployment resourceselector eval worker",
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

	kind := events.DeploymentResourceselectorEvalKind
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
		log.Fatal("Failed to create deployment resourceselector eval worker", "error", err)
	}

	return worker
}
