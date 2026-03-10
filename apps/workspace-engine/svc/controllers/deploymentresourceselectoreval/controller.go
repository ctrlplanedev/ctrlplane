package deploymentresourceselectoreval

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/store/resources"
	"workspace-engine/svc"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentresourceselectoreval")
var _ reconcile.Processor = (*Controller)(nil)

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

	resources, err := c.getter.GetResources(
		ctx,
		deployment.WorkspaceID.String(),
		resources.GetResourcesOptions{
			CEL: deployment.ResourceSelector,
		},
	)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get resources: %w", err)
	}

	matchedIDs := make([]uuid.UUID, 0, len(resources))
	for _, resource := range resources {
		resourceIDUUID, err := uuid.Parse(resource.Id)
		if err != nil {
			log.Error("failed to parse resource id", "resource_id", resource.Id, "error", err)
			continue
		}
		matchedIDs = append(matchedIDs, resourceIDUUID)
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

func (c *Controller) enqueueReleaseTargets(
	ctx context.Context,
	workspaceID uuid.UUID,
	releaseTargets []ReleaseTarget,
) error {
	_, span := tracer.Start(ctx, "EnqueueReleaseTargets")
	defer span.End()
	span.SetAttributes(attribute.Int("count", len(releaseTargets)))

	wsID := workspaceID.String()
	params := make([]events.DesiredReleaseEvalParams, len(releaseTargets))
	for i, rt := range releaseTargets {
		params[i] = events.DesiredReleaseEvalParams{
			WorkspaceID:   wsID,
			ResourceID:    rt.ResourceID.String(),
			EnvironmentID: rt.EnvironmentID.String(),
			DeploymentID:  rt.DeploymentID.String(),
		}
	}
	return events.EnqueueManyDesiredRelease(c.queue, ctx, params)
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
	ctx := context.Background()
	controller := &Controller{
		getter: NewPostgresGetter(db.GetQueries(ctx)),
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
